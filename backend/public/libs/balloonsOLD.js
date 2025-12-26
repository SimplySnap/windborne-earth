// Balloon visualization overlay

let balloonData = [];
let balloonTrajectoriesVisible = true;

// ------------------------------
// Visibility helper
// ------------------------------
function isPointVisible(projection, lon, lat) {
  if (!projection) return false;          // error checking

  const rotate = projection.rotate();  // [lambda, phi, gamma]
  const λ = (lon + rotate[0]) * Math.PI / 180;
  const φ = (lat + rotate[1]) * Math.PI / 180;
  return Math.cos(φ) * Math.cos(λ) > 0;
}

// ------------------------------
// Data loading / processing
// ------------------------------
async function initBalloons() {
  try {
    const response = await fetch('/api/balloons');
    const data = await response.json();
    balloonData = processBalloonData(data.balloons);

    // Assign colors: yellow -> red -> magenta gradient
    const numBalloons = balloonData.length;
    balloonData.forEach((balloon, i) => {
      const t = i / Math.max(1, numBalloons - 1); // 0 to 1
      balloon.color = `hsl(${0.083 - 0.083 * t * 360}, 100%, ${50 + 50 * t}%)`;
    });

    setupControls();
    // First draw
    renderBalloons();
  } catch (e) {
    console.error('Failed to load balloons:', e);
  }
}

function processBalloonData(rawRecords) {
  console.log('Total records:', rawRecords.length);
  const balloons = {};

  rawRecords.forEach((record, idx) => {
    if (!Array.isArray(record) || record.length < 2) return;
    const lat = parseFloat(record[0]);
    const lon = parseFloat(record[1]);
    if (isNaN(lat) || isNaN(lon)) return;

    // Use index within array as balloon ID (0–999)
    const index = record._index != null ? record._index : (idx % 1000);
    const id = `balloon_${index}`;
    if (!balloons[id]) {
      balloons[id] = { id, points: [] };
    }
    balloons[id].points.push({
      lat,
      lon,
      alt: parseFloat(record[2] || 0)
      // no time field any more — purely static
    });
  });

  console.log('Unique balloons:', Object.keys(balloons).length);

  const result = Object.values(balloons).filter(b => b.points.length >= 2);
  console.log('Plottable balloons:', result.length);
  return result;
}

// ------------------------------
// Color helper
// ------------------------------
function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

// ------------------------------
// UI controls
// ------------------------------
function setupControls() {
  document.getElementById('balloon-toggle').onclick = () => {
    const panel = document.getElementById('balloon-controls');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  };

  document.getElementById('show-trajectories').onchange = (e) => {
    balloonTrajectoriesVisible = e.target.checked;
    // no direct renderBalloons() here; RAF loop handles it
  };
}





// ------------------------------
// Rendering
// ------------------------------
function renderBalloons() {
  const overlayCanvas = document.querySelector('canvas.overlay') || document.querySelector('canvas');
  if (!overlayCanvas || !balloonTrajectoriesVisible || !balloonData.length) return;

  const ctx = overlayCanvas.getContext('2d');
  const width = overlayCanvas.width;
  const height = overlayCanvas.height;

  const globe = window.currentGlobe;
  if (!globe || !globe.projection) return;

  const projection = globe.projection;
  
  // SAFE fieldAgent check
  let field = null;
  try {
    if (window.fieldAgent && window.fieldAgent.value) {
      field = window.fieldAgent.value;
      if (typeof field.isInsideBoundary !== 'function') field = null;
    }
  } catch(e) {
    field = null;
  }

  // CRITICAL: Match Earth's wind particle compositing EXACTLY
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'source-over';  // Draw on top
  ctx.clearRect(0, 0, width, height);           // Fresh frame
  
  balloonData.forEach(balloon => {
    ctx.strokeStyle = balloon.color;
    ctx.lineWidth = 0.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let firstPoint = true;
    balloon.points.forEach(point => {
      const lon = point.lon;
      const lat = point.lat;
      
      const pointXY = projection([lon, lat]);
      if (!pointXY || !isFinite(pointXY[0]) || !isFinite(pointXY[1])) return;
      
      const x = pointXY[0];
      const y = pointXY[1];
      
      if (field && !field.isInsideBoundary(x, y)) return;

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    });

    if (!firstPoint) ctx.stroke();

    const last = balloon.points[balloon.points.length - 1];
    const lastXY = projection([last.lon, last.lat]);
    if (lastXY && isFinite(lastXY[0]) && isFinite(lastXY[1])) {
      const [mx, my] = lastXY;
      const shouldShowDot = !field || (field && field.isInsideBoundary(mx, my));
      if (shouldShowDot) {
        ctx.shadowColor = balloon.color;
        ctx.shadowBlur = 4;
        ctx.fillStyle = balloon.color;
        ctx.beginPath();
        ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  });

  // RESTORE original compositing
  ctx.globalCompositeOperation = prevComposite;
}

// ------------------------------
// Hook into Earth's animation loop
// ------------------------------
// Called once when Earth is ready
function attachBalloonRenderer() {
  if (!window.rendererAgent) return;
  
  // BOTH for smooth dragging + full renders
  window.rendererAgent.on('render', renderBalloons);
  //window.rendererAgent.on('redraw', renderBalloons); //remove to stop console spam
  
  console.log('Balloons: render + redraw events');
}

window.addEventListener("load", function () {
  initBalloons();
  attachBalloonRenderer();
});
