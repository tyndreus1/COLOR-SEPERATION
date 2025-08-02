import React, { useRef, useEffect } from "react";

export default function ChannelPreview({ imageData, label, thumbHeight = 100, onDownload, filename }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.putImageData(imageData, 0, 0);
    }
  }, [imageData]);

  function handleDownload() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = filename || `${label}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    if (onDownload) onDownload(canvasRef.current);
  }

  // Thumbnail oranı hesapla
  let displayWidth = imageData?.width || 0;
  let displayHeight = imageData?.height || 0;
  if (displayHeight > thumbHeight) {
    displayWidth = Math.round(displayWidth * (thumbHeight / displayHeight));
    displayHeight = thumbHeight;
  }

  return (
    <div style={{ textAlign: "center", margin: "1rem", width: displayWidth }}>
      <h4>{label}</h4>
      <canvas
        ref={canvasRef}
        width={imageData?.width || 0}
        height={imageData?.height || 0}
        style={{
          border: "1px solid #aaa",
          background: "#fff",
          width: displayWidth,
          height: displayHeight,
          cursor: "pointer"
        }}
        title="Tıkla ve indir"
        onClick={handleDownload}
      />
      <br/>
      <button onClick={handleDownload} style={{ marginTop: 8 }}>Kaydet</button>
    </div>
  );
}