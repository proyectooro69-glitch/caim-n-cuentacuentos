import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, Undo, Trash2 } from "lucide-react";

interface ColoringCanvasProps {
  imageUrl: string | null;
  pageId: string;
  onSave: (drawingData: string) => void;
  initialDrawing?: string;
}

const COLORS = [
  { name: "Rojo", value: "#FFB3B3" },
  { name: "Naranja", value: "#FFCC99" },
  { name: "Amarillo", value: "#FFF2AA" },
  { name: "Verde", value: "#A8E6B4" },
  { name: "Azul", value: "#A8D8FF" },
  { name: "Morado", value: "#E6B3FF" },
  { name: "Rosa", value: "#FFCCE0" },
  { name: "Café", value: "#C89B7B" },
];

const ColoringCanvas = ({
  imageUrl,
  pageId,
  onSave,
  initialDrawing,
}: ColoringCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(20);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [showBrush, setShowBrush] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Restore drawing after resize
      if (initialDrawing) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = initialDrawing;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [initialDrawing]);

  const getCanvasCoords = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-10), imageData]);
  }, []);

  const startDrawing = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      saveToHistory();
      setIsDrawing(true);
      setShowBrush(false);
      const pos = getCanvasCoords(e);
      lastPos.current = pos;
      setCursorPos(pos);
    },
    [getCanvasCoords, saveToHistory]
  );

  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      const pos = getCanvasCoords(e);
      setCursorPos(pos);

      if (!isDrawing) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !lastPos.current) return;

      ctx.globalCompositeOperation = isEraser ? "destination-out" : "multiply";
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = brushSize;

      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      lastPos.current = pos;
    },
    [isDrawing, selectedColor, brushSize, isEraser, getCanvasCoords]
  );

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setShowBrush(true);
      lastPos.current = null;

      // Save drawing
      const canvas = canvasRef.current;
      if (canvas) {
        const drawingData = canvas.toDataURL("image/png");
        onSave(drawingData);
      }
    }
  }, [isDrawing, onSave]);

  const handleUndo = () => {
    if (history.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const lastState = history[history.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    saveToHistory();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSave("");
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Color palette */}
      <div className="flex flex-wrap gap-2 justify-center">
        {COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => {
              setSelectedColor(color.value);
              setIsEraser(false);
            }}
            className={`w-10 h-10 rounded-full touch-friendly transition-transform hover:scale-110 ${
              selectedColor === color.value && !isEraser
                ? "ring-4 ring-foreground ring-offset-2 scale-110"
                : ""
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
        <Button
          variant={isEraser ? "default" : "outline"}
          size="icon"
          onClick={() => setIsEraser(!isEraser)}
          className="w-10 h-10 rounded-full touch-friendly"
        >
          <Eraser className="h-5 w-5" />
        </Button>
      </div>

      {/* Brush size slider */}
      <div className="flex items-center gap-3 px-4">
        <span className="text-sm text-muted-foreground">Grosor:</span>
        <Slider
          value={[brushSize]}
          onValueChange={(v) => setBrushSize(v[0])}
          min={5}
          max={50}
          step={5}
          className="flex-1"
        />
        <div
          className="rounded-full bg-foreground"
          style={{ width: brushSize, height: brushSize, minWidth: 5 }}
        />
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-white rounded-xl overflow-hidden border-2 border-border shadow-inner"
      >
        {/* Background image */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Página para colorear"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        )}

        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 coloring-canvas"
          style={{ mixBlendMode: "multiply" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Brush cursor indicator */}
        {showBrush && !isDrawing && (
          <div
            className="pointer-events-none absolute transition-all duration-75"
            style={{
              left: cursorPos.x - brushSize / 2,
              top: cursorPos.y - brushSize / 2,
              width: brushSize,
              height: brushSize,
              borderRadius: "50%",
              border: `2px solid ${isEraser ? "#666" : selectedColor}`,
              backgroundColor: isEraser ? "transparent" : `${selectedColor}40`,
            }}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-center">
        <Button
          variant="outline"
          onClick={handleUndo}
          disabled={history.length === 0}
          className="touch-friendly"
        >
          <Undo className="mr-2 h-4 w-4" />
          Deshacer
        </Button>
        <Button
          variant="destructive"
          onClick={handleClear}
          className="touch-friendly"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Limpiar dibujo
        </Button>
      </div>
    </div>
  );
};

export default ColoringCanvas;
