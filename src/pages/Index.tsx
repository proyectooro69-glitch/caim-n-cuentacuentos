import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Book, Palette, Sparkles, Volume2 } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-secondary/10 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8 md:py-12">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/20 p-4 rounded-full">
              <Book className="h-12 w-12 md:h-16 md:w-16 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground">
            Cuentos para Colorear
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Crea cuentos mágicos con inteligencia artificial y deja que los niños los coloreen
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 border-primary/20 bg-card/80 backdrop-blur">
            <CardContent className="pt-6 text-center">
              <Sparkles className="h-10 w-10 text-accent-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-lg">IA Creativa</h3>
              <p className="text-sm text-muted-foreground">
                Genera cuentos únicos con solo ingresar un tema
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-secondary/30 bg-card/80 backdrop-blur">
            <CardContent className="pt-6 text-center">
              <Palette className="h-10 w-10 text-secondary-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-lg">Colorear Digital</h3>
              <p className="text-sm text-muted-foreground">
                Ilustraciones en blanco y negro para colorear con el dedo
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-accent/30 bg-card/80 backdrop-blur">
            <CardContent className="pt-6 text-center">
              <Volume2 className="h-10 w-10 text-accent-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-lg">Audio Narración</h3>
              <p className="text-sm text-muted-foreground">
                Escucha el cuento en voz alta mientras coloreas
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-muted/50 bg-card/80 backdrop-blur">
            <CardContent className="pt-6 text-center">
              <Book className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-lg">Exportar PDF</h3>
              <p className="text-sm text-muted-foreground">
                Descarga el cuento coloreado como recuerdo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <Card className="border-2 border-primary/30 shadow-xl bg-gradient-to-r from-primary/10 to-accent/10">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl md:text-3xl">
              ¿Lista para crear un cuento?
            </CardTitle>
            <CardDescription className="text-base">
              Ingresa al panel de autora y genera tu primer cuento mágico
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-xl touch-friendly">
              <Link to="/author">
                <Sparkles className="mr-2 h-5 w-5" />
                Crear Mi Cuento
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="text-center py-6 space-y-2">
          <p className="text-lg font-medium text-foreground">
            Soluciones Digitales Caimán 🐊
          </p>
          <p className="text-sm text-muted-foreground">
            Creando magia digital para los más pequeños
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
