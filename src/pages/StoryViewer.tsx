import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, Volume2, VolumeX, Download, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ColoringCanvas from "@/components/ColoringCanvas";
import StoryCover from "@/components/StoryCover";
import jsPDF from "jspdf";

interface StoryPage {
  id: string;
  page_number: number;
  narrative_text: string;
  image_url: string | null;
}

interface Story {
  id: string;
  title: string;
  theme: string;
}

const STORAGE_KEY_PREFIX = "coloring_drawing_";

const getDrawingKey = (storyId: string, pageId: string) =>
  `${STORAGE_KEY_PREFIX}${storyId}_${pageId}`;

const StoryViewer = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const speakingRef = useRef(false);
  const { toast } = useToast();

  // Load story and pages
  useEffect(() => {
    const loadStory = async () => {
      if (!shareCode) return;

      try {
        const { data: storyData, error: storyError } = await supabase
          .from("stories")
          .select("*")
          .eq("share_code", shareCode)
          .maybeSingle();

        if (storyError) throw storyError;
        if (!storyData) {
          toast({
            title: "Cuento no encontrado",
            description: "El enlace del cuento no es válido",
            variant: "destructive",
          });
          return;
        }

        setStory(storyData);

        const { data: pagesData, error: pagesError } = await supabase
          .from("story_pages")
          .select("*")
          .eq("story_id", storyData.id)
          .order("page_number");

        if (pagesError) throw pagesError;
        setPages(pagesData || []);

        // Load drawings from localStorage
        if (pagesData && pagesData.length > 0) {
          const drawingsMap: Record<string, string> = {};
          pagesData.forEach((p) => {
            const saved = localStorage.getItem(getDrawingKey(storyData.id, p.id));
            if (saved) {
              drawingsMap[p.id] = saved;
            }
          });
          setDrawings(drawingsMap);
        }
      } catch (error) {
        console.error("Error loading story:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar el cuento",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadStory();
  }, [shareCode, toast]);

  // Save drawing to localStorage
  const handleSaveDrawing = useCallback(
    (drawingData: string) => {
      const pageIdx = currentPage - 1;
      const page = pages[pageIdx];
      if (!page || !story || pageIdx < 0) return;

      setDrawings((prev) => ({ ...prev, [page.id]: drawingData }));

      if (drawingData) {
        localStorage.setItem(getDrawingKey(story.id, page.id), drawingData);
      } else {
        localStorage.removeItem(getDrawingKey(story.id, page.id));
      }
    },
    [pages, currentPage, story]
  );

  // Text-to-speech - using ref to avoid re-render issues
  const handleSpeak = useCallback(() => {
    const pageIdx = currentPage - 1;
    const page = pages[pageIdx];
    if (!page || pageIdx < 0) return;

    // Always cancel any ongoing speech first
    window.speechSynthesis.cancel();

    if (speakingRef.current) {
      speakingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(page.narrative_text);
      utterance.lang = "es-ES";
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      // Try to find a Spanish voice
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(v => v.lang.startsWith("es"));
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      utterance.onend = () => {
        speakingRef.current = false;
        setIsSpeaking(false);
      };
      utterance.onerror = (e) => {
        console.error("SpeechSynthesis error:", e);
        speakingRef.current = false;
        setIsSpeaking(false);
      };

      speakingRef.current = true;
      setIsSpeaking(true);

      // Small delay to ensure cancel() completed
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (error) {
      console.error("SpeechSynthesis error:", error);
      speakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [pages, currentPage]);

  // Navigation
  const goToPage = useCallback((pageNum: number) => {
    window.speechSynthesis.cancel();
    speakingRef.current = false;
    setIsSpeaking(false);
    setCurrentPage(pageNum);
  }, []);

  // PDF generation
  const handleDownloadPdf = useCallback(async () => {
    if (!story || pages.length === 0) return;

    setGeneratingPdf(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      const coverShareUrl = `${window.location.origin}/cuento/${shareCode}`;

      // === COVER PAGE ===
      // Decorative top band
      pdf.setFillColor(244, 180, 196); // pastel pink
      pdf.rect(0, 0, pageWidth, 8, "F");
      pdf.setFillColor(180, 230, 210); // pastel mint
      pdf.rect(0, 8, pageWidth, 4, "F");

      // Title
      pdf.setFontSize(32);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(180, 60, 100);
      pdf.text(story.title, pageWidth / 2, 40, { align: "center" });

      // Theme subtitle
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(120, 120, 120);
      pdf.text(story.theme, pageWidth / 2, 52, { align: "center" });

      // Cover illustration (first page image)
      const coverImgUrl = pages[0]?.image_url;
      if (coverImgUrl) {
        try {
          const coverImg = await loadImage(coverImgUrl);
          const imgSize = 120;
          const imgX = (pageWidth - imgSize) / 2;
          const imgY = 65;
          // White background with rounded border effect
          pdf.setDrawColor(244, 180, 196);
          pdf.setLineWidth(1.5);
          pdf.roundedRect(imgX - 3, imgY - 3, imgSize + 6, imgSize + 6, 5, 5, "S");
          const canvas = document.createElement("canvas");
          canvas.width = coverImg.naturalWidth;
          canvas.height = coverImg.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(coverImg, 0, 0);
            pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", imgX, imgY, imgSize, imgSize);
          }
        } catch {
          // skip cover image
        }
      }

      // Share link
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text("Lee este cuento aquí:", pageWidth / 2, 200, { align: "center" });
      pdf.setFontSize(10);
      pdf.setTextColor(180, 60, 100);
      pdf.textWithLink(coverShareUrl, pageWidth / 2 - pdf.getTextWidth(coverShareUrl) / 2, 208, { url: coverShareUrl });

      // Branding
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text("Colección de cuentos por", pageWidth / 2, 240, { align: "center" });
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(180, 60, 100);
      pdf.text("Soluciones Digitales Caimán", pageWidth / 2, 248, { align: "center" });

      // Bottom band
      pdf.setFillColor(180, 230, 210);
      pdf.rect(0, pageHeight - 12, pageWidth, 4, "F");
      pdf.setFillColor(244, 180, 196);
      pdf.rect(0, pageHeight - 8, pageWidth, 8, "F");

      // === STORY PAGES ===
      for (let i = 0; i < pages.length; i++) {
        pdf.addPage();

        const page = pages[i];

        // Page number
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(`Página ${i + 1} de ${pages.length}`, pageWidth / 2, pageHeight - 10, { align: "center" });
        pdf.setTextColor(0);

        // Narrative text
        const textY = margin;
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "normal");
        const splitText = pdf.splitTextToSize(page.narrative_text, contentWidth);
        pdf.text(splitText, margin, textY);

        const textHeight = splitText.length * 7;
        const imageY = textY + textHeight + 10;
        const imageMaxH = pageHeight - imageY - 20;

        // Draw the coloring image + drawing overlay
        const drawingData = drawings[page.id];
        
        if (page.image_url || drawingData) {
          // Create a composite canvas
          const compositeCanvas = document.createElement("canvas");
          const compW = 800;
          const compH = 600;
          compositeCanvas.width = compW;
          compositeCanvas.height = compH;
          const compCtx = compositeCanvas.getContext("2d");
          if (compCtx) {
            compCtx.fillStyle = "#ffffff";
            compCtx.fillRect(0, 0, compW, compH);

            // Draw coloring book image
            if (page.image_url) {
              try {
                const bgImg = await loadImage(page.image_url);
                compCtx.drawImage(bgImg, 0, 0, compW, compH);
              } catch {
                // skip if image fails
              }
            }

            // Draw child's coloring on top with multiply
            if (drawingData) {
              try {
                const drawImg = await loadImage(drawingData);
                compCtx.globalCompositeOperation = "multiply";
                compCtx.drawImage(drawImg, 0, 0, compW, compH);
                compCtx.globalCompositeOperation = "source-over";
              } catch {
                // skip
              }
            }

            const imgData = compositeCanvas.toDataURL("image/jpeg", 0.85);
            const imgW = contentWidth;
            const imgH = Math.min((contentWidth * compH) / compW, imageMaxH);
            pdf.addImage(imgData, "JPEG", margin, imageY, imgW, imgH);
          }
        }
      }

      // Back cover
      pdf.addPage();
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("¡Fin!", pageWidth / 2, pageHeight / 2 - 20, { align: "center" });
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.text("Creado con amor por", pageWidth / 2, pageHeight / 2, { align: "center" });
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Soluciones Digitales Caimán", pageWidth / 2, pageHeight / 2 + 12, { align: "center" });

      // QR placeholder
      pdf.setDrawColor(200);
      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect(pageWidth / 2 - 25, pageHeight / 2 + 25, 50, 50, 3, 3, "FD");
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text("Código QR", pageWidth / 2, pageHeight / 2 + 55, { align: "center" });

      pdf.save(`${story.title}.pdf`);
      toast({ title: "¡PDF descargado!", description: "Tu cuento coloreado está listo." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "No se pudo generar el PDF", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  }, [story, pages, drawings, toast]);

  // Page 0 is the cover, pages 1..N map to story pages
  const isCoverPage = currentPage === 0;
  const storyPageIndex = currentPage - 1;
  const currentPageData = isCoverPage ? null : pages[storyPageIndex];
  const totalPagesWithCover = pages.length + 1;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPagesWithCover - 1;

  const shareUrl = `${window.location.origin}/cuento/${shareCode}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-muted-foreground">Cargando cuento...</p>
        </div>
      </div>
    );
  }

  if (!story || pages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-foreground">Cuento no encontrado</h1>
          <p className="text-muted-foreground">
            El enlace que usaste no es válido o el cuento ya no existe.
          </p>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Ir al inicio
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b p-3 flex items-center justify-between shadow-sm">
        <h1 className="text-lg md:text-xl font-bold text-primary truncate flex-1">
          {story.title}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">
            {currentPage === 0 ? "Portada" : `${storyPageIndex + 1} / ${pages.length}`}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {isCoverPage ? (
          <div className="flex-1 overflow-auto">
            <StoryCover
              title={story.title}
              theme={story.theme}
              imageUrl={pages[0]?.image_url || null}
              shareUrl={shareUrl}
            />
          </div>
        ) : (
          <>
            {/* Text section */}
            <div className="lg:w-1/3 p-4 lg:p-6 flex flex-col gap-3 bg-card/50">
              <Card className="p-4 md:p-6 bg-card flex-1 overflow-auto">
                <p className="text-lg md:text-xl lg:text-2xl leading-relaxed font-medium">
                  {currentPageData?.narrative_text}
                </p>
              </Card>

              {/* Audio + PDF buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleSpeak}
                  variant={isSpeaking ? "secondary" : "default"}
                  className="flex-1 h-14 text-lg rounded-xl touch-friendly"
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="mr-2 h-6 w-6" />
                      Detener
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-6 w-6" />
                      Escuchar
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  variant="outline"
                  className="h-14 px-4 text-lg rounded-xl touch-friendly border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {generatingPdf ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-6 w-6" />
                  )}
                  <span className="hidden sm:inline">Descargar mi Cuento</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
              </div>
            </div>

            {/* Coloring section */}
            <div className="flex-1 p-4 lg:p-6 flex flex-col min-h-[50vh] lg:min-h-0">
              <ColoringCanvas
                key={currentPageData?.id || storyPageIndex}
                imageUrl={currentPageData?.image_url || null}
                pageId={currentPageData?.id || ""}
                onSave={handleSaveDrawing}
                initialDrawing={drawings[currentPageData?.id || ""]}
              />
            </div>
          </>
        )}
      </main>

      {/* Navigation footer */}
      <footer className="bg-card border-t p-3 flex items-center justify-between gap-4">
        <Button
          onClick={() => goToPage(currentPage - 1)}
          disabled={isFirstPage}
          variant="outline"
          className="h-12 px-4 md:px-6 rounded-xl touch-friendly"
        >
          <ChevronLeft className="h-5 w-5 md:mr-2" />
          <span className="hidden md:inline">Anterior</span>
        </Button>

        <div className="flex gap-2 overflow-x-auto py-2 px-1">
          {Array.from({ length: totalPagesWithCover }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToPage(idx)}
              className={`w-3 h-3 md:w-4 md:h-4 rounded-full transition-all ${
                idx === currentPage
                  ? "bg-primary scale-125"
                  : "bg-muted hover:bg-primary/50"
              }`}
            />
          ))}
        </div>

        <Button
          onClick={() => goToPage(currentPage + 1)}
          disabled={isLastPage}
          variant="outline"
          className="h-12 px-4 md:px-6 rounded-xl touch-friendly"
        >
          <span className="hidden md:inline">Siguiente</span>
          <ChevronRight className="h-5 w-5 md:ml-2" />
        </Button>
      </footer>
    </div>
  );
};

// Helper to load an image as a promise
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default StoryViewer;
