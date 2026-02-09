import { Card } from "@/components/ui/card";

interface StoryCoverProps {
  title: string;
  theme: string;
  imageUrl: string | null;
  shareUrl: string;
}

const StoryCover = ({ title, theme, imageUrl, shareUrl }: StoryCoverProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 gap-6">
      {/* Cover card */}
      <Card className="w-full max-w-lg overflow-hidden border-4 border-primary/30 shadow-xl rounded-3xl bg-gradient-to-b from-accent/40 via-card to-secondary/30">
        {/* Top decorative band */}
        <div className="h-3 bg-gradient-to-r from-primary via-accent to-secondary" />

        {/* Title */}
        <div className="px-6 pt-6 pb-2 text-center">
          <h1
            className="text-3xl md:text-4xl font-extrabold leading-tight text-primary drop-shadow-sm"
            style={{ fontFamily: "'Nunito', 'Comic Sans MS', cursive" }}
          >
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground italic">{theme}</p>
        </div>

        {/* Illustration */}
        <div className="px-6 py-4 flex justify-center">
          <div className="w-full max-w-xs aspect-square rounded-2xl border-2 border-primary/20 bg-white overflow-hidden flex items-center justify-center shadow-inner">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`Portada de ${title}`}
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <span className="text-6xl">📖</span>
            )}
          </div>
        </div>

        {/* Share link */}
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Lee este cuento aquí:</p>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary underline underline-offset-2 break-all hover:text-primary/80 transition-colors"
          >
            {shareUrl}
          </a>
        </div>

        {/* Bottom decorative band */}
        <div className="h-3 bg-gradient-to-r from-secondary via-accent to-primary" />
      </Card>

      {/* Branding */}
      <p className="text-xs text-muted-foreground text-center">
        Colección de cuentos por <span className="font-bold">Soluciones Digitales Caimán</span>
      </p>
    </div>
  );
};

export default StoryCover;
