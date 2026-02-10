import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, Undo, Trash2, PaintBucket } from "lucide-react";

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
  const bgImageDataRef = useRef<ImageData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(8);
  const [isEraser, setIsEraser] = useState(false);
  const [isFillMode, setIsFillMode] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [showBrush, setShowBrush] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-10), imageData]);
  }, []);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  // Load background image pixel data for flood fill boundary detection
  useEffect(() => {
    if (!imageUrl) {
      bgImageDataRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      // Draw image filling the canvas to match the displayed image
      tempCtx.fillStyle = "#ffffff";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Calculate object-contain dimensions
      const containerW = tempCanvas.width;
      const containerH = tempCanvas.height;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const containerRatio = containerW / containerH;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgRatio > containerRatio) {
        drawW = containerW;
        drawH = containerW / imgRatio;
        drawX = 0;
        drawY = (containerH - drawH) / 2;
      } else {
        drawH = containerH;
        drawW = containerH * imgRatio;
        drawX = (containerW - drawW) / 2;
        drawY = 0;
      }
      tempCtx.drawImage(img, drawX, drawY, drawW, drawH);

      bgImageDataRef.current = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const floodFill = useCallback((startX: number, startY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    saveToHistory();

    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(startX * dpr);
    const py = Math.floor(startY * dpr);
    const w = canvas.width;
    const h = canvas.height;

    if (px < 0 || px >= w || py < 0 || py >= h) return;

    const drawingData = ctx.getImageData(0, 0, w, h);
    const dData = drawingData.data;
    const bgData = bgImageDataRef.current?.data;

    const fill = hexToRgb(selectedColor);
    const fillAlpha = 115; // ~45% opacity

    // Check if a pixel is a dark border in the background image
    const isBorderPixel = (i: number): boolean => {
      if (!bgData) return false;
      const r = bgData[i], g = bgData[i + 1], b = bgData[i + 2];
      // Dark pixel = border line (threshold: brightness < 80)
      return (r + g + b) / 3 < 80;
    };

    // Check if the drawing canvas pixel at this position is already filled with our color
    const isAlreadyFilled = (i: number): boolean => {
      return dData[i] === fill.r && dData[i + 1] === fill.g && dData[i + 2] === fill.b && dData[i + 3] === fillAlpha;
    };

    // Check if a pixel on the drawing canvas is "empty" (transparent or very light)
    const isEmptyPixel = (i: number): boolean => {
      return dData[i + 3] < 30; // mostly transparent = unfilled
    };

    const startIdx = (py * w + px) * 4;

    // Don't fill if clicking on a border
    if (isBorderPixel(startIdx)) return;
    // Don't fill if already this color
    if (isAlreadyFilled(startIdx)) return;

    // Determine what we're replacing: check the starting pixel
    const startR = dData[startIdx], startG = dData[startIdx + 1], startB = dData[startIdx + 2], startA = dData[startIdx + 3];
    const startIsEmpty = startA < 30;

    const canFill = (i: number): boolean => {
      // Stop at borders in the background image
      if (isBorderPixel(i)) return false;
      // Stop if already filled with target color
      if (isAlreadyFilled(i)) return false;

      if (startIsEmpty) {
        // We're filling an empty area - only fill empty pixels
        return isEmptyPixel(i);
      } else {
        // We're replacing an existing color - match similar pixels
        const tolerance = 60;
        const dr = Math.abs(dData[i] - startR);
        const dg = Math.abs(dData[i + 1] - startG);
        const db = Math.abs(dData[i + 2] - startB);
        const da = Math.abs(dData[i + 3] - startA);
        return dr + dg + db + da < tolerance;
      }
    };

    const stack = [px, py];
    const visited = new Uint8Array(w * h);

    while (stack.length > 0) {
      const cy = stack.pop()!;
      const cx = stack.pop()!;

      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

      const ci = cy * w + cx;
      if (visited[ci]) continue;
      visited[ci] = 1;

      const pi = ci * 4;
      if (!canFill(pi)) continue;

      dData[pi] = fill.r;
      dData[pi + 1] = fill.g;
      dData[pi + 2] = fill.b;
      dData[pi + 3] = fillAlpha;

      stack.push(cx + 1, cy);
      stack.push(cx - 1, cy);
      stack.push(cx, cy + 1);
      stack.push(cx, cy - 1);
    }

    ctx.putImageData(drawingData, 0, 0);
    const result = canvas.toDataURL("image/png");
    onSave(result);
  }, [selectedColor, onSave, saveToHistory]);

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

  const startDrawing = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      const pos = getCanvasCoords(e);
      setCursorPos(pos);

      if (isFillMode) {
        floodFill(pos.x, pos.y);
        return;
      }

      saveToHistory();
      setIsDrawing(true);
      setShowBrush(false);
      lastPos.current = pos;
    },
    [getCanvasCoords, saveToHistory, isFillMode, floodFill]
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
      ctx.globalAlpha = isEraser ? 1.0 : 0.45;

      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      lastPos.current = pos;
    },
    [isDrawing, selectedColor, brushSize, isEraser, getCanvasCoords]
  );

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setShowBrush(true);
      lastPos.current = null;

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
          variant={isFillMode ? "default" : "outline"}
          size="icon"
          onClick={() => { setIsFillMode(!isFillMode); setIsEraser(false); }}
          className="w-10 h-10 rounded-full touch-friendly"
          title="Rellenar zona"
        >
          <PaintBucket className="h-5 w-5" />
        </Button>
        <Button
          variant={isEraser ? "default" : "outline"}
          size="icon"
          onClick={() => { setIsEraser(!isEraser); setIsFillMode(false); }}
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
          min={3}
          max={30}
          step={1}
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
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Página para colorear"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        )}

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
