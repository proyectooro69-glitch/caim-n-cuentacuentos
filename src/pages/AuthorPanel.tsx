import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Book, Share2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateStory } from "@/lib/storyGenerator";
import LanguageSelector from "@/components/LanguageSelector";

interface GeneratedStory {
  id: string;
  title: string;
  shareCode: string;
}

const AuthorPanel = () => {
  const [theme, setTheme] = useState("");
  const [lang, setLang] = useState<"es" | "en">("es");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const t = {
    es: {
      panelTitle: "Panel de Autora",
      panelSub: "Crea cuentos mágicos para colorear",
      createTitle: "Crear Nuevo Cuento",
      createDesc: "Ingresa un tema y la IA generará un cuento de 5 páginas con imágenes para colorear",
      themeLabel: "Tema del cuento",
      themePlaceholder: "Ej: un dragón amigable, una princesa valiente, un gatito aventurero...",
      generating: "Creando cuento mágico...",
      generate: "Generar Cuento",
      generatingHint: "Escribiendo la historia y dibujando las imágenes...",
      generatingHint2: "Esto puede tomar unos minutos",
      created: "¡Cuento Creado!",
      titleLabel: "Título:",
      shareLabel: "Enlace para compartir:",
      viewStory: "Ver Cuento",
      themeRequired: "Tema requerido",
      themeRequiredDesc: "Por favor, ingresa un tema para el cuento",
      storyReady: "¡Cuento creado!",
      linkCopied: "¡Enlace copiado!",
      linkCopiedDesc: "El enlace del cuento está en tu portapapeles",
      errorTitle: "Error al generar",
      errorDesc: "No se pudo generar el cuento",
    },
    en: {
      panelTitle: "Author Panel",
      panelSub: "Create magical coloring stories",
      createTitle: "Create New Story",
      createDesc: "Enter a theme and AI will generate a 5-page story with coloring images",
      themeLabel: "Story theme",
      themePlaceholder: "E.g.: a friendly dragon, a brave princess, an adventurous kitten...",
      generating: "Creating magical story...",
      generate: "Generate Story",
      generatingHint: "Writing the story and drawing the images...",
      generatingHint2: "This may take a few minutes",
      created: "Story Created!",
      titleLabel: "Title:",
      shareLabel: "Share link:",
      viewStory: "View Story",
      themeRequired: "Theme required",
      themeRequiredDesc: "Please enter a theme for the story",
      storyReady: "Story created!",
      linkCopied: "Link copied!",
      linkCopiedDesc: "The story link is in your clipboard",
      errorTitle: "Generation error",
      errorDesc: "Could not generate the story",
    },
  };

  const i = t[lang];

  const handleGenerate = async () => {
    if (!theme.trim()) {
      toast({ title: i.themeRequired, description: i.themeRequiredDesc, variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedStory(null);
    setProgressMsg("");

    try {
      const result = await generateStory(theme, lang, (msg) => setProgressMsg(msg));
      setGeneratedStory(result);
      toast({ title: i.storyReady, description: `"${result.title}"` });
    } catch (error) {
      console.error("Error generating story:", error);
      toast({
        title: i.errorTitle,
        description: error instanceof Error ? error.message : i.errorDesc,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgressMsg("");
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
    toast({ title: i.linkCopied, description: i.linkCopiedDesc });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-end mb-2">
            <LanguageSelector lang={lang} onChange={setLang} />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-3">
            <Book className="h-8 w-8 md:h-10 md:w-10" />
            {i.panelTitle}
          </h1>
          <p className="text-muted-foreground text-lg">{i.panelSub}</p>
        </div>

        {/* Story Generator Card */}
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
              {i.createTitle}
            </CardTitle>
            <CardDescription>{i.createDesc}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="theme" className="text-sm font-medium">{i.themeLabel}</label>
              <Input
                id="theme"
                placeholder={i.themePlaceholder}
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
                  {i.generating}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {i.generate}
                </>
              )}
            </Button>

            {isGenerating && (
              <div className="text-center text-muted-foreground animate-pulse">
                <p>{progressMsg || i.generatingHint}</p>
                <p className="text-sm">{i.generatingHint2}</p>
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
                {i.created}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{i.titleLabel}</p>
                <p className="text-xl font-semibold">{generatedStory.title}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Share2 className="h-4 w-4" />
                  {i.shareLabel}
                </div>
                <div className="flex gap-2">
                  <Input value={getShareUrl()} readOnly className="flex-1 text-sm bg-muted" />
                  <Button onClick={handleCopyLink} variant="secondary" size="icon" className="h-10 w-10 touch-friendly">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button asChild variant="outline" className="w-full h-12 text-lg rounded-xl">
                <a href={getShareUrl()} target="_blank" rel="noopener noreferrer">
                  {i.viewStory}
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
