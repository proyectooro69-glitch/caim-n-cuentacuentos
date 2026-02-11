import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Book, Share2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GeneratedStory {
  id: string;
  title: string;
  shareCode: string;
}

const AuthorPanel = () => {
  const [theme, setTheme] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!theme.trim()) {
      toast({
        title: "Tema requerido",
        description: "Por favor, ingresa un tema para el cuento",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedStory(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-story", {
        body: { theme },
      });

      if (error) {
        // Try to extract the real error message from the response
        const context = (error as any)?.context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            throw new Error(body.error || error.message);
          } catch (e) {
            if (e instanceof Error && e.message !== error.message) throw e;
          }
        }
        throw error;
      }

      if (data.success) {
        setGeneratedStory(data.story);
        toast({
          title: "¡Cuento creado!",
          description: `"${data.story.title}" está listo para compartir`,
        });
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error generating story:", error);
      toast({
        title: "Error al generar",
        description: error instanceof Error ? error.message : "No se pudo generar el cuento",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getShareUrl = () => {
    if (!generatedStory) return "";
    return `${window.location.origin}/story/${generatedStory.shareCode}`;
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({
      title: "¡Enlace copiado!",
      description: "El enlace del cuento está en tu portapapeles",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-3">
            <Book className="h-8 w-8 md:h-10 md:w-10" />
            Panel de Autora
          </h1>
          <p className="text-muted-foreground text-lg">
            Crea cuentos mágicos para colorear
          </p>
        </div>

        {/* Story Generator Card */}
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
              Crear Nuevo Cuento
            </CardTitle>
            <CardDescription>
              Ingresa un tema y la IA generará un cuento de 5 páginas con imágenes para colorear
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="theme" className="text-sm font-medium">
                Tema del cuento
              </label>
              <Input
                id="theme"
                placeholder="Ej: un dragón amigable, una princesa valiente, un gatito aventurero..."
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={isGenerating}
                className="text-lg h-12 border-2 focus:border-primary"
              />
            </div>
            
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !theme.trim()}
              className="w-full h-14 text-lg font-semibold rounded-xl touch-friendly"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creando cuento mágico...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generar Cuento
                </>
              )}
            </Button>

            {isGenerating && (
              <div className="text-center text-muted-foreground animate-pulse">
                <p>Escribiendo la historia y dibujando las imágenes...</p>
                <p className="text-sm">Esto puede tomar unos minutos</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generated Story Card */}
        {generatedStory && (
          <Card className="border-2 border-secondary shadow-lg animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="bg-gradient-to-r from-secondary/30 to-pastel-mint/30 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-xl text-secondary-foreground">
                <Book className="h-5 w-5" />
                ¡Cuento Creado!
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Título:</p>
                <p className="text-xl font-semibold">{generatedStory.title}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Share2 className="h-4 w-4" />
                  Enlace para compartir:
                </div>
                <div className="flex gap-2">
                  <Input
                    value={getShareUrl()}
                    readOnly
                    className="flex-1 text-sm bg-muted"
                  />
                  <Button
                    onClick={handleCopyLink}
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10 touch-friendly"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                className="w-full h-12 text-lg rounded-xl"
              >
                <a href={getShareUrl()} target="_blank" rel="noopener noreferrer">
                  Ver Cuento
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Soluciones Digitales Caimán 🐊
        </p>
      </div>
    </div>
  );
};

export default AuthorPanel;
