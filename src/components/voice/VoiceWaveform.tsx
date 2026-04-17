import { useEffect, useRef } from "react";

interface Props {
  stream: MediaStream | null;
  active: boolean;
}

export function VoiceWaveform({ stream, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current || !active) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const barCount = 48;
      const barWidth = w / barCount;
      for (let i = 0; i < barCount; i++) {
        const v = data[Math.floor((i / barCount) * data.length)] / 255;
        const barHeight = Math.max(2, v * h * 0.9);
        const hue = 200 + v * 40;
        ctx.fillStyle = `hsl(${hue}, 80%, ${50 + v * 20}%)`;
        ctx.fillRect(i * barWidth + 1, (h - barHeight) / 2, barWidth - 2, barHeight);
      }
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtx.close().catch(() => {});
    };
  }, [stream, active]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={120}
      className="w-full h-24 rounded-lg bg-secondary/30"
      aria-label="Visualizador de áudio"
    />
  );
}
