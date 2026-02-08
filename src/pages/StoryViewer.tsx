import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, Volume2, VolumeX, Download, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ColoringCanvas from "@/components/ColoringCanvas";

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

const StoryViewer = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionId] = useState(() => {
    // Get or create session ID for this device/browser
    let id = localStorage.getItem("story_session_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("story_session_id", id);
    }
    return id;
  });
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Load story and pages
  useEffect(() => {
    const loadStory = async () => {
      if (!shareCode) return;

      try {
        // Fetch story by share code
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

        // Fetch pages
        const { data: pagesData, error: pagesError } = await supabase
          .from("story_pages")
          .select("*")
          .eq("story_id", storyData.id)
          .order("page_number");

        if (pagesError) throw pagesError;
        setPages(pagesData || []);

        // Load saved drawings for all pages
        if (pagesData && pagesData.length > 0) {
          const pageIds = pagesData.map((p) => p.id);
          const { data: drawingsData } = await supabase
            .from("page_drawings")
            .select("*")
            .in("page_id", pageIds)
            .eq("session_id", sessionId);

          if (drawingsData) {
            const drawingsMap: Record<string, string> = {};
            drawingsData.forEach((d) => {
              drawingsMap[d.page_id] = d.drawing_data;
            });
            setDrawings(drawingsMap);
          }
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
  }, [shareCode, sessionId, toast]);

  // Save drawing to database
  const handleSaveDrawing = useCallback(
    async (drawingData: string) => {
      const page = pages[currentPage];
      if (!page) return;

      setDrawings((prev) => ({ ...prev, [page.id]: drawingData }));

      try {
        const { error } = await supabase.from("page_drawings").upsert(
          {
            page_id: page.id,
            session_id: sessionId,
            drawing_data: drawingData,
          },
          { onConflict: "page_id,session_id" }
        );

        if (error) throw error;
      } catch (error) {
        console.error("Error saving drawing:", error);
      }
    },
    [pages, currentPage, sessionId]
  );

  // Text-to-speech
  const handleSpeak = () => {
    const page = pages[currentPage];
    if (!page) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(page.narrative_text);
    utterance.lang = "es-ES";
    utterance.rate = 0.9;
    utterance.pitch = 1.1;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Navigation
  const goToPage = (pageNum: number) => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentPage(pageNum);
  };

  const currentPageData = pages[currentPage];
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === pages.length - 1;

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
            {currentPage + 1} / {pages.length}
          </span>
        </div>
      </header>

      {/* Main content - responsive layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Text section */}
        <div className="lg:w-1/3 p-4 lg:p-6 flex flex-col gap-4 bg-card/50">
          <Card className="p-4 md:p-6 bg-card flex-1 overflow-auto">
            <p className="text-lg md:text-xl lg:text-2xl leading-relaxed font-medium">
              {currentPageData?.narrative_text}
            </p>
          </Card>

          {/* Audio button */}
          <Button
            onClick={handleSpeak}
            variant={isSpeaking ? "secondary" : "default"}
            className="w-full h-14 text-lg rounded-xl touch-friendly"
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
        </div>

        {/* Coloring section */}
        <div className="flex-1 p-4 lg:p-6 flex flex-col min-h-[50vh] lg:min-h-0">
          <ColoringCanvas
            imageUrl={currentPageData?.image_url || null}
            pageId={currentPageData?.id || ""}
            sessionId={sessionId}
            onSave={handleSaveDrawing}
            initialDrawing={drawings[currentPageData?.id || ""]}
          />
        </div>
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

        {/* Page dots */}
        <div className="flex gap-2 overflow-x-auto py-2 px-1">
          {pages.map((_, idx) => (
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

export default StoryViewer;
