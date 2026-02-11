import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, Volume2, VolumeX, Download, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ColoringCanvas from "@/components/ColoringCanvas";
import StoryCover from "@/components/StoryCover";
import LanguageSelector from "@/components/LanguageSelector";
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
  cover_image_url?: string | null;
}

const STORAGE_KEY_PREFIX = "coloring_drawing_";

const getDrawingKey = (storyId: string, pageId: string) =>
  `${STORAGE_KEY_PREFIX}${storyId}_${pageId}`;

const i18n = {
  es: {
    loading: "Cargando cuento...",
    notFound: "Cuento no encontrado",
    notFoundDesc: "El enlace que usaste no es válido o el cuento ya no existe.",
    goHome: "Ir al inicio",
    cover: "Portada",
    stop: "Detener",
    listen: "Escuchar",
    downloadFull: "Descargar mi Cuento",
    downloadShort: "PDF",
    prev: "Anterior",
    next: "Siguiente",
    pdfReady: "¡PDF descargado!",
    pdfReadyDesc: "Tu cuento coloreado está listo.",
    pdfError: "No se pudo generar el PDF",
    storyNotFoundToast: "Cuento no encontrado",
    storyNotFoundToastDesc: "El enlace del cuento no es válido",
    errorToast: "Error",
    errorToastDesc: "No se pudo cargar el cuento",
    pageOf: "de",
    end: "¡Fin!",
    createdWith: "Creado con amor por",
    readHere: "Lee este cuento aquí:",
    collection: "Colección de cuentos por",
  },
  en: {
    loading: "Loading story...",
    notFound: "Story not found",
    notFoundDesc: "The link you used is invalid or the story no longer exists.",
    goHome: "Go home",
    cover: "Cover",
    stop: "Stop",
    listen: "Listen",
    downloadFull: "Download my Story",
    downloadShort: "PDF",
    prev: "Previous",
    next: "Next",
    pdfReady: "PDF downloaded!",
    pdfReadyDesc: "Your colored story is ready.",
    pdfError: "Could not generate the PDF",
    storyNotFoundToast: "Story not found",
    storyNotFoundToastDesc: "The story link is not valid",
    errorToast: "Error",
    errorToastDesc: "Could not load the story",
    pageOf: "of",
    end: "The End!",
    createdWith: "Created with love by",
    readHere: "Read this story here:",
    collection: "Story collection by",
  },
};

const StoryViewer = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");
  const speakingRef = useRef(false);
  const { toast } = useToast();

  const t = i18n[lang];

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
          toast({ title: t.storyNotFoundToast, description: t.storyNotFoundToastDesc, variant: "destructive" });
          return;
        }

        setStory(storyData as any);

        const { data: pagesData, error: pagesError } = await supabase
          .from("story_pages")
          .select("*")
          .eq("story_id", storyData.id)
          .order("page_number");

        if (pagesError) throw pagesError;
        setPages(pagesData || []);

        if (pagesData && pagesData.length > 0) {
          const drawingsMap: Record<string, string> = {};
          pagesData.forEach((p) => {
            const saved = localStorage.getItem(getDrawingKey(storyData.id, p.id));
            if (saved) drawingsMap[p.id] = saved;
          });
          setDrawings(drawingsMap);
        }
      } catch (error) {
        console.error("Error loading story:", error);
        toast({ title: t.errorToast, description: t.errorToastDesc, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    loadStory();
  }, [shareCode]);

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

  const handleSpeak = useCallback(() => {
    const pageIdx = currentPage - 1;
    const page = pages[pageIdx];
    if (!page || pageIdx < 0) return;

    window.speechSynthesis.cancel();

    if (speakingRef.current) {
      speakingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(page.narrative_text);
      utterance.lang = lang === "en" ? "en-US" : "es-ES";
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      const voices = window.speechSynthesis.getVoices();
      const prefix = lang === "en" ? "en" : "es";
      const voice = voices.find((v) => v.lang.startsWith(prefix));
      if (voice) utterance.voice = voice;

      utterance.onend = () => { speakingRef.current = false; setIsSpeaking(false); };
      utterance.onerror = () => { speakingRef.current = false; setIsSpeaking(false); };

      speakingRef.current = true;
      setIsSpeaking(true);

      setTimeout(() => window.speechSynthesis.speak(utterance), 50);
    } catch {
      speakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [pages, currentPage, lang]);

  const goToPage = useCallback((pageNum: number) => {
    window.speechSynthesis.cancel();
    speakingRef.current = false;
    setIsSpeaking(false);
    setCurrentPage(pageNum);
  }, []);

  // PDF generation — no QR code on back cover
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
      pdf.setFillColor(244, 180, 196);
      pdf.rect(0, 0, pageWidth, 8, "F");
      pdf.setFillColor(180, 230, 210);
      pdf.rect(0, 8, pageWidth, 4, "F");

      pdf.setFontSize(32);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(180, 60, 100);
      pdf.text(story.title, pageWidth / 2, 40, { align: "center" });

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(120, 120, 120);
      pdf.text(story.theme, pageWidth / 2, 52, { align: "center" });

      // Cover illustration (prefer color cover)
      const coverImgUrl = story.cover_image_url || pages[0]?.image_url;
      if (coverImgUrl) {
        try {
          const coverImg = await loadImage(coverImgUrl);
          const imgSize = 120;
          const imgX = (pageWidth - imgSize) / 2;
          const imgY = 65;
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
        } catch { /* skip */ }
      }

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(t.readHere, pageWidth / 2, 200, { align: "center" });
      pdf.setFontSize(10);
      pdf.setTextColor(180, 60, 100);
      pdf.textWithLink(coverShareUrl, pageWidth / 2 - pdf.getTextWidth(coverShareUrl) / 2, 208, { url: coverShareUrl });

      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text(t.collection, pageWidth / 2, 240, { align: "center" });
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(180, 60, 100);
      pdf.text("Soluciones Digitales Caimán", pageWidth / 2, 248, { align: "center" });

      pdf.setFillColor(180, 230, 210);
      pdf.rect(0, pageHeight - 12, pageWidth, 4, "F");
      pdf.setFillColor(244, 180, 196);
      pdf.rect(0, pageHeight - 8, pageWidth, 8, "F");

      // === STORY PAGES ===
      for (let i = 0; i < pages.length; i++) {
        pdf.addPage();
        const page = pages[i];

        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(`${i + 1} ${t.pageOf} ${pages.length}`, pageWidth / 2, pageHeight - 10, { align: "center" });
        pdf.setTextColor(0);

        const textY = margin;
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "normal");
        const splitText = pdf.splitTextToSize(page.narrative_text, contentWidth);
        pdf.text(splitText, margin, textY);

        const textHeight = splitText.length * 7;
        const imageY = textY + textHeight + 10;
        const imageMaxH = pageHeight - imageY - 20;

        const drawingData = drawings[page.id];

        if (page.image_url || drawingData) {
          const compositeCanvas = document.createElement("canvas");
          const compW = 800;
          const compH = 600;
          compositeCanvas.width = compW;
          compositeCanvas.height = compH;
          const compCtx = compositeCanvas.getContext("2d");
          if (compCtx) {
            compCtx.fillStyle = "#ffffff";
            compCtx.fillRect(0, 0, compW, compH);

            if (page.image_url) {
              try {
                const bgImg = await loadImage(page.image_url);
                compCtx.drawImage(bgImg, 0, 0, compW, compH);
              } catch { /* skip */ }
            }

            if (drawingData) {
              try {
                const drawImg = await loadImage(drawingData);
                compCtx.globalCompositeOperation = "multiply";
                compCtx.drawImage(drawImg, 0, 0, compW, compH);
                compCtx.globalCompositeOperation = "source-over";
              } catch { /* skip */ }
            }

            const imgData = compositeCanvas.toDataURL("image/jpeg", 0.85);
            const imgW = contentWidth;
            const imgH = Math.min((contentWidth * compH) / compW, imageMaxH);
            pdf.addImage(imgData, "JPEG", margin, imageY, imgW, imgH);
          }
        }
      }

      // Back cover — NO QR code
      pdf.addPage();
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text(t.end, pageWidth / 2, pageHeight / 2 - 20, { align: "center" });
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.text(t.createdWith, pageWidth / 2, pageHeight / 2, { align: "center" });
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Soluciones Digitales Caimán", pageWidth / 2, pageHeight / 2 + 12, { align: "center" });

      pdf.save(`${story.title}.pdf`);
      toast({ title: t.pdfReady, description: t.pdfReadyDesc });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: t.errorToast, description: t.pdfError, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  }, [story, pages, drawings, toast, shareCode, t]);

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
          <p className="text-lg text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!story || pages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-foreground">{t.notFound}</h1>
          <p className="text-muted-foreground">{t.notFoundDesc}</p>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              {t.goHome}
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
        <div className="flex items-center gap-3">
          <LanguageSelector lang={lang} onChange={setLang} />
          <span className="text-sm text-muted-foreground font-medium">
            {currentPage === 0 ? t.cover : `${storyPageIndex + 1} / ${pages.length}`}
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
              coverImageUrl={story.cover_image_url}
              shareUrl={shareUrl}
              lang={lang}
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

              <div className="flex gap-2">
                <Button
                  onClick={handleSpeak}
                  variant={isSpeaking ? "secondary" : "default"}
                  className="flex-1 h-14 text-lg rounded-xl touch-friendly"
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="mr-2 h-6 w-6" />
                      {t.stop}
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-6 w-6" />
                      {t.listen}
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
                  <span className="hidden sm:inline">{t.downloadFull}</span>
                  <span className="sm:hidden">{t.downloadShort}</span>
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
          <span className="hidden md:inline">{t.prev}</span>
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
          <span className="hidden md:inline">{t.next}</span>
          <ChevronRight className="h-5 w-5 md:ml-2" />
        </Button>
      </footer>
    </div>
  );
};

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
