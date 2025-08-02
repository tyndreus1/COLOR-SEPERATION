import React, { useRef, useState, useEffect } from "react";
import {
  separateCMYKExclusive,
  separateCMYKHalftoneExclusive,
  separateCMYKHalftone8x8Exclusive
} from "./CMYKUtils";
import ChannelPreview from "./ChannelPreview";

const CHANNELS = [
  { name: "Cyan", code: "C" },
  { name: "Magenta", code: "M" },
  { name: "Yellow", code: "Y" },
  { name: "Black", code: "K" }
];

const ALGO_OPTIONS = [
  { label: "Exclusive (her piksel sadece bir kanalda)", value: "exclusive" },
  { label: "Halftone 4x4 (doku, overlap yok)", value: "halftone4x4" },
  { label: "Halftone 8x8 (doku, overlap yok)", value: "halftone8x8" }
];

function mmToPixels(mm, dpi = 850) {
  return Math.round(mm * dpi / 25.4);
}

function getBaseName(filename) {
  return filename?.split("\\").pop().split("/").pop().split(".").slice(0, -1).join(".") || "image";
}

function downloadCanvasAsPng(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function getSeparationFunction(type) {
  if (type === "exclusive") return separateCMYKExclusive;
  if (type === "halftone8x8") return separateCMYKHalftone8x8Exclusive;
  return separateCMYKHalftoneExclusive;
}

function App() {
  const [original, setOriginal] = useState(null);
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [origSize, setOrigSize] = useState({ width: 0, height: 0 });

  const [targetWidthMm, setTargetWidthMm] = useState(22);
  const [targetHeightMm, setTargetHeightMm] = useState(0);

  const [algoType, setAlgoType] = useState("halftone8x8");

  const imageRef = useRef(null);
  const channelCanvasRefs = useRef([null, null, null, null]);

  function handleFileChange(e) {
    setError("");
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match(/^image/)) {
      setError("Lütfen bir resim dosyası yükleyin.");
      return;
    }
    setSourceName(file.name);
    setChannels([]);
    setOriginal(null);

    const reader = new FileReader();
    reader.onload = ev => {
      setOriginal(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleWidthChange(e) {
    const value = parseFloat(e.target.value);
    if (isNaN(value) || value <= 0) return;
    setTargetWidthMm(value);
    if (origSize.width && origSize.height) {
      const aspect = origSize.height / origSize.width;
      setTargetHeightMm(value * aspect);
    }
  }

  function performSeparation(img) {
    const aspect = img.naturalHeight / img.naturalWidth;
    const widthPx = mmToPixels(targetWidthMm);
    const heightPx = Math.round(widthPx * aspect);
    setTargetHeightMm(widthPx * aspect * 25.4 / 850);

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    const imageData = ctx.getImageData(0, 0, widthPx, heightPx);

    const sepFn = getSeparationFunction(algoType);
    const channelData = sepFn(imageData);
    setChannels(channelData);
  }

  function handleImageLoaded() {
    const img = imageRef.current;
    setOrigSize({ width: img.naturalWidth, height: img.naturalHeight });
    performSeparation(img);
  }

  useEffect(() => {
    if (original && imageRef.current) {
      performSeparation(imageRef.current);
    }
    // eslint-disable-next-line
  }, [algoType, targetWidthMm, original]);

  function handleDownloadAll() {
    channels.forEach((_, idx) => {
      const canvas = channelCanvasRefs.current[idx];
      if (canvas) {
        const baseName = getBaseName(sourceName);
        const code = CHANNELS[idx].code;
        downloadCanvasAsPng(canvas, `${baseName}${code}.png`);
      }
    });
  }

  return (
    <div style={{
      fontFamily: "Poppins, Arial, sans-serif",
      maxWidth: 1200,
      margin: "0 auto",
      padding: 32
    }}>
      <h1 style={{
        color: "#0072ef",
        textShadow: "1px 2px 6px #aaddff"
      }}>IDEA Rainbo Color Separation</h1>
      <p>
        <b>Fotoğraf yükleyin</b> ve <span style={{color:"#0072ef"}}>CMYK</span> kanallarını küçük önizleme olarak görün.<br/>
        Her birini ya da hepsini birlikte kaydedebilirsiniz.<br/>
        <span style={{fontSize:13, color:"#555"}}>
          Çıktılar, en boy oranı korunarak {targetWidthMm}mm genişlikte ve 850 DPI ile hazırlanır.
        </span>
      </p>

      <div style={{margin:"16px 0"}}>
        <label>
          <b>Genişlik (mm): </b>
          <input
            type="number"
            step="0.1"
            value={targetWidthMm}
            min={1}
            onChange={handleWidthChange}
            style={{ width:60, marginRight:12 }}
          />
        </label>
        <span>
          <b>Yükseklik (mm): </b>
          {targetHeightMm ? targetHeightMm.toFixed(2) : "?"}
        </span>
        <span style={{marginLeft:16, color:"#999"}}>
          (Çıktı: {mmToPixels(targetWidthMm)} x {mmToPixels(targetHeightMm)} px @ 850 DPI)
        </span>
      </div>

      <div style={{margin:"16px 0"}}>
        <label>
          <b>CMYK Ayrım Algoritması: </b>
          <select value={algoType} onChange={e => setAlgoType(e.target.value)}>
            {ALGO_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <input type="file" accept="image/*" onChange={handleFileChange} style={{marginBottom:12}}/>
      {error && <p style={{color:"red"}}>{error}</p>}

      {original && (
        <div style={{ margin: "2rem 0" }}>
          <h3 style={{marginBottom:8}}>Orijinal Görsel</h3>
          <img
            ref={imageRef}
            src={original}
            alt="original"
            style={{ maxWidth: 400, maxHeight: 300, border: "1px solid #bbb" }}
            onLoad={handleImageLoaded}
          />
        </div>
      )}

      {channels.length > 0 && (
        <>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "16px"
          }}>
            {channels.map((data, idx) => (
              <ChannelPreview
                key={CHANNELS[idx].name}
                imageData={data}
                label={CHANNELS[idx].name}
                filename={`${getBaseName(sourceName)}${CHANNELS[idx].code}.png`}
                thumbHeight={100}
                ref={el => channelCanvasRefs.current[idx] = el ? el.querySelector("canvas") : null}
                onDownload={canvas => { channelCanvasRefs.current[idx] = canvas; }}
              />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={handleDownloadAll} style={{ fontWeight: 600, fontSize: 17 }}>
              Tüm Kanalları Toplu Kaydet
            </button>
          </div>
        </>
      )}

      <footer style={{marginTop:32, fontSize:14, color:"#777"}}>
        &copy; {new Date().getFullYear()} IDEA Rainbo Color Separation | MOPA lazer kullanıcıları için
      </footer>
    </div>
  );
}

export default App;