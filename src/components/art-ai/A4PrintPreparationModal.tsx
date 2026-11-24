import React, { useEffect, useRef, useState } from 'react';
import { Printer, AlertTriangle, RotateCw, Download } from 'lucide-react';
import { CustomModal } from '../ui/CustomModal';

interface A4PrintPreparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName?: string;
}

export function A4PrintPreparationModal({ isOpen, onClose, imageUrl, fileName = 'arte-a4' }: A4PrintPreparationModalProps) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState(12);
  const [copies, setCopies] = useState(1);
  const [background, setBackground] = useState<'white' | 'transparent'>('white');
  const [cutOutline, setCutOutline] = useState(false);
  const [columns, setColumns] = useState(1);
  const [rows, setRows] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [lowResolution, setLowResolution] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const image = new Image();
    image.onload = () => {
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
      const shortSideDpi = Math.min(image.naturalWidth / (orientation === 'portrait' ? 210 : 297) * 25.4, image.naturalHeight / (orientation === 'portrait' ? 297 : 210) * 25.4);
      setLowResolution(shortSideDpi < 150);
      drawPreview(image);
    };
    image.src = imageUrl;
  }, [imageUrl, orientation, margin, copies, columns, rows, background, cutOutline]);

  const drawPreview = (image: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = 3;
    canvas.width = (orientation === 'portrait' ? 210 : 297) * scale;
    canvas.height = (orientation === 'portrait' ? 297 : 210) * scale;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (background === 'white') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    const safeMargin = margin * scale;
    const availableWidth = canvas.width - safeMargin * 2;
    const availableHeight = canvas.height - safeMargin * 2;
    const gap = 8 * scale;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const cellWidth = (availableWidth - gap * (columns - 1)) / columns;
        const cellHeight = (availableHeight - gap * (rows - 1)) / rows;
        const ratio = Math.min(cellWidth / image.naturalWidth, cellHeight / image.naturalHeight);
        const width = image.naturalWidth * ratio;
        const height = image.naturalHeight * ratio;
        const x = safeMargin + column * (cellWidth + gap) + (cellWidth - width) / 2;
        const y = safeMargin + row * (cellHeight + gap) + (cellHeight - height) / 2;
        context.drawImage(image, x, y, width, height);
        if (cutOutline) {
          context.save();
          context.strokeStyle = '#94a3b8';
          context.lineWidth = 1;
          context.setLineDash([4 * scale, 3 * scale]);
          context.strokeRect(x - 2 * scale, y - 2 * scale, width + 4 * scale, height + 4 * scale);
          context.restore();
        }
      }
    }
  };

  const exportA4Pdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const pageWidth = orientation === 'portrait' ? '210mm' : '297mm';
    const pageHeight = orientation === 'portrait' ? '297mm' : '210mm';

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
      <style>@page{size:${pageWidth} ${pageHeight};margin:0}html,body{margin:0;width:${pageWidth};height:${pageHeight};overflow:hidden}img{width:${pageWidth};height:${pageHeight};object-fit:contain}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style>
      </head><body><img src="${dataUrl}" alt="Arte preparada para impressão"></body><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></html>`);
    printWindow.document.close();
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Preparar para impressão A4" cancelText="Fechar" showCancelButton>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700">Orientação</label>
            <select value={orientation} onChange={(event) => setOrientation(event.target.value as 'portrait' | 'landscape')} className="input-base mt-1">
              <option value="portrait">A4 vertical</option>
              <option value="landscape">A4 horizontal</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Margem (mm)</label>
            <input type="number" min={0} max={25} value={margin} onChange={(event) => setMargin(Math.max(0, Math.min(25, Number(event.target.value))))} className="input-base mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-slate-700">Colunas</label><input type="number" min={1} max={6} value={columns} onChange={(event) => setColumns(Math.max(1, Math.min(6, Number(event.target.value))))} className="input-base mt-1" /></div>
            <div><label className="text-xs font-bold text-slate-700">Linhas</label><input type="number" min={1} max={6} value={rows} onChange={(event) => setRows(Math.max(1, Math.min(6, Number(event.target.value))))} className="input-base mt-1" /></div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Cópias</label>
            <input type="number" min={1} max={20} value={copies} onChange={(event) => setCopies(Math.max(1, Math.min(20, Number(event.target.value))))} className="input-base mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700">Fundo</label>
            <select value={background} onChange={(event) => setBackground(event.target.value as 'white' | 'transparent')} className="input-base mt-1">
              <option value="white">Branco</option>
              <option value="transparent">Transparente</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={cutOutline} onChange={(event) => setCutOutline(event.target.checked)} className="accent-brand-600" />
            Contorno de recorte
          </label>

          {lowResolution && (
            <div className="flex gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-[11px] text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>A resolução pode ser insuficiente para impressão. Verifique o arquivo original antes de imprimir.</span>
            </div>
          )}

          <button type="button" onClick={exportA4Pdf} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white font-bold text-xs">
            <Download className="w-4 h-4" /> Baixar PDF A4
          </button>
        </div>

        <div className="min-h-[360px] flex items-center justify-center rounded-2xl border border-pink-100 bg-slate-50 p-3">
          <canvas ref={canvasRef} className={`max-w-full max-h-[65vh] shadow-lg ${orientation === 'portrait' ? 'aspect-[210/297]' : 'aspect-[297/210]'}`} />
        </div>
      </div>
    </CustomModal>
  );
}
