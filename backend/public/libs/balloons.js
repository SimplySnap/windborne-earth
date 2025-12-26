let balloonData = [];
let balloonDotsVisible = true;
let balloonTrajectoriesVisible = true;

async function initBalloons() {
  try {
    const response = await fetch('/api/balloons');
    const data = await response.json();
    balloonData = processBalloonData(data.balloons);
    
    // Assign colors (yellow -> red -> magenta gradient)
    const numBalloons = balloonData.length;
    balloonData.forEach((balloon, i) => {
      const t = i / Math.max(1, numBalloons - 1); // 0 to 1
      balloon.color = `hsl(${0.083 - 0.083 * t * 360}, 100%, ${50 + 50 * t}%)`;
    });
    
    console.log('Unique balloons:', numBalloons);
    console.log('Plottable balloons:', balloonData.length);
    setupControls();
    renderBalloons(); // First draw
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
    
    const index = record.index != null ? record.index : idx % 1000;
    const id = `balloon${index}`;
    
    if (!balloons[id]) {
      balloons[id] = { id, points: [] };
    }
    balloons[id].points.push({ lat, lon });
  });
  
  const result = Object.values(balloons).filter(b => b.points.length >= 2);
  console.log('Plottable balloons:', result.length);
  return result;
}

function renderBalloonDotsSVG() {
  if (!balloonDotsVisible || !balloonData || !balloonData.length) return;
  const globe = window.currentGlobe;
  if (!globe || !globe.projection) return;

  const projection = globe.projection;

  // Remove existing marks
  d3.select('#foreground').selectAll('.balloon-dot').remove();

  const field = (window.fieldAgent && window.fieldAgent.value &&
                 typeof window.fieldAgent.value.isInsideBoundary === 'function')
                ? window.fieldAgent.value
                : null;

  const svg = d3.select('#foreground');

  balloonData.forEach(balloon => {
    const last = balloon.points[balloon.points.length - 1];
    const lastXY = projection([last.lon, last.lat]);
    if (!lastXY || !isFinite(lastXY[0]) || !isFinite(lastXY[1])) return;

    const x = lastXY[0], y = lastXY[1];
    if (field && !field.isInsideBoundary(x, y)) return;

    svg.append('circle')
       .attr('class', 'balloon-dot')
       .attr('cx', x)
       .attr('cy', y)
       .attr('r', 2.5)
       .style('fill', balloon.color)
       .style('stroke', 'none')
       .style('pointer-events', 'none');
  });
}

function renderBalloonTrajectoriesSVG() {
  if (!balloonTrajectoriesVisible || !balloonData || !balloonData.length) return;
  const globe = window.currentGlobe;
  if (!globe || !globe.projection) return;

  const projection = globe.projection;

  // Remove existing trajectory paths
  d3.select('#foreground').selectAll('.balloon-traj').remove();

  const field = (window.fieldAgent && window.fieldAgent.value &&
                 typeof window.fieldAgent.value.isInsideBoundary === 'function')
                ? window.fieldAgent.value
                : null;

  const svg = d3.select('#foreground');

  balloonData.forEach(balloon => {
    const projectedPoints = [];

    balloon.points.forEach(point => {
      const pt = projection([point.lon, point.lat]);
      if (!pt || !isFinite(pt[0]) || !isFinite(pt[1])) return;
      const x = pt[0], y = pt[1];
      if (field && !field.isInsideBoundary(x, y)) return;
      projectedPoints.push([x, y]);
    });

    if (projectedPoints.length < 2) return;

    const line = d3.svg.line()
      .x(d => d[0])
      .y(d => d[1])
      .interpolate('linear');

    svg.append('path')
       .attr('class', 'balloon-traj')
       .attr('d', line(projectedPoints))
       .style('fill', 'none')
       .style('stroke', balloon.color)
       .style('stroke-width', 0.6)
       .style('stroke-linecap', 'round')
       .style('stroke-linejoin', 'round')
       .style('pointer-events', 'none');
  });
}


function renderBalloons(fullRedraw = true) {
  // SVG dots first
  renderBalloonDotsSVG();
  // Everything is SVG now: static, independent of wind fade
  renderBalloonTrajectoriesSVG();
  /*
  const overlayCanvas = document.querySelector('canvas.overlay') || document.querySelector('canvas');
  if (!overlayCanvas || !balloonData.length) return;
  if (!balloonTrajectoriesVisible) {
    // No trails: just don’t touch overlay; dots are on SVG
    return;
  }

  const ctx = overlayCanvas.getContext('2d');
  const width = overlayCanvas.width;
  const height = overlayCanvas.height;
  const globe = window.currentGlobe;
  if (!globe || !globe.projection) return;

  const projection = globe.projection;

  let field = null;
  try {
    if (window.fieldAgent && window.fieldAgent.value &&
        typeof window.fieldAgent.value.isInsideBoundary === 'function') {
      field = window.fieldAgent.value;
    }
  } catch (e) {}

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  if (fullRedraw) {
    ctx.clearRect(0, 0, width, height);
  }

  balloonData.forEach(balloon => {
    ctx.strokeStyle = balloon.color;
    ctx.lineWidth = 0.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let firstPoint = true;
    balloon.points.forEach(point => {
      const pt = projection([point.lon, point.lat]);
      if (!pt || !isFinite(pt[0]) || !isFinite(pt[1])) return;
      const x = pt[0], y = pt[1];
      if (field && !field.isInsideBoundary(x, y)) return;

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    });

    if (!firstPoint) ctx.stroke();
  });

  ctx.restore();
  */
}

function attachBalloonRenderer() {
  if (!window.rendererAgent) return;

  window.rendererAgent.on('render', renderBalloons);
  window.rendererAgent.on('redraw', renderBalloons);

  console.log('Balloons SVG renderer attached');
}

function setupControls() {
  const toggleBtn = document.getElementById('balloon-toggle');
  if (toggleBtn) {
    toggleBtn.onclick = function() {
      const panel = document.getElementById('balloon-details');
      if (panel) {
        panel.style.display =
          (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
      }
    };
  }

  const dotsCheckbox = document.getElementById('balloon-dots');
  if (dotsCheckbox) {
    dotsCheckbox.onchange = e => {
      balloonDotsVisible = e.target.checked;
      if (!balloonDotsVisible) {
        // Immediately remove existing dot circles
        d3.select('#foreground').selectAll('.balloon-dot').remove();
      } else {
        // Recreate dots when re-enabled
        renderBalloonDotsSVG();
      }
    };
  }

  const trajCheckbox = document.getElementById('show-trajectories');
  if (trajCheckbox) {
    trajCheckbox.onchange = e => {
      balloonTrajectoriesVisible = e.target.checked;
      if (!balloonTrajectoriesVisible) {
        d3.select('#foreground').selectAll('.balloon-traj').remove();
      } else {
        renderBalloonTrajectoriesSVG();
      }
    };
  }
}

// Auto-init
window.addEventListener('load', () => {
  initBalloons().then(attachBalloonRenderer);
});
