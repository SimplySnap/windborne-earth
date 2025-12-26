let balloonData = [];
let balloonDotsVisible = true;
let balloonTrajectoriesVisible = true;
let selectedBalloonId = null;   // null = show all
function isFilteredMode() {
  return !!selectedBalloonId;
}

async function initBalloons() {
  try {
    const response = await fetch('/api/balloons'); //Wait for jsons
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
    populateBalloonSelect();
    setupControls();
    renderBalloons(); // First draw
  } catch (e) {
    console.error('Failed to load balloons:', e);
  }
}

function populateBalloonSelect() {
  const select = document.getElementById('balloon-select');
  if (!select || !balloonData || !balloonData.length) return;

  // Clear existing, keep the first "All balloons" option
  select.innerHTML = '<option value="">All balloons</option>';

  balloonData.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;          // id like "balloon123"
    opt.textContent = b.id;
    select.appendChild(opt);
  });
}

function getVisibleBalloons() {
  if (!balloonData) return [];
  if (!selectedBalloonId) return balloonData;
  return balloonData.filter(b => b.id === selectedBalloonId);
}

function isOrthographic(proj) {
    return proj.clipAngle && proj.clipAngle() === 90;
}

function getProjectionType(globe) {
  // Check if this globe matches the orthographic factory
  if (globe && globe.newProjection && typeof globe.newProjection === 'function') {
    try {
      // Capture the projection constructor used by this globe
      const proj = globe.newProjection({width: 960, height: 500});
      if (proj && proj.clipAngle && proj.clipAngle() === 90) {
        return 'orthographic'; // Matches orthographic() factory [file:80]
      }
    } catch (e) {}
  }
  return null;
}

function shouldRenderPoint(projection, lon, lat) {
  const pt = projection([lon, lat]);
  if (!pt || !isFinite(pt[0]) || !isFinite(pt[1])) return false;
  
  const globe = window.currentGlobe;
  const projType = getProjectionType(globe);
  
  if (projType === 'orthographic') {
    // Proper orthographic culling using rotation
    try {
      const rotate = projection.rotate();
      if (Array.isArray(rotate) && rotate.length >= 2) {
        const lambda = (rotate[0] || 0) * Math.PI / 180;
        const phi = (rotate[1] || 0) * Math.PI / 180;
        const pointRad = d3.geoDistance([lambda, phi], [lon * Math.PI / 180, lat * Math.PI / 180]);
        return pointRad < Math.PI / 2; // Front hemisphere only
      }
    } catch (e) {}
  }
  
  return true;
}

function renderBalloonDotsSVG() {
  if (!balloonDotsVisible || !balloonData || !balloonData.length) return;
  const globe = window.currentGlobe;
  if (!globe || !globe.projection) return;
  
  const projection = globe.projection;
  d3.select('#foreground').selectAll('.balloon-dot').remove();
  
  const field = (window.fieldAgent && window.fieldAgent.value &&
    typeof window.fieldAgent.value.isInsideBoundary === 'function')
    ? window.fieldAgent.value : null;
  
  const svg = d3.select('#foreground');
  
  getVisibleBalloons().forEach(balloon => {
    const last = balloon.points[0];

    //Culling for orthographic projection
    // NEW: Orthographic culling
    if (isOrthographic(projection)) {
        const rotate = projection.rotate();
        const center = [-rotate[0], -rotate[1]];
        if (d3.geo.distance(center, [last.lon, last.lat]) > Math.PI / 2) return;
    }
    
    if (!shouldRenderPoint(projection, last.lon, last.lat)) return; // ← KEY FIX
    const lastXY = projection([last.lon, last.lat]);
    const x = lastXY[0], y = lastXY[1];
    
    if (field && !field.isInsideBoundary(x, y)) return;
    
    const circle = svg.append('circle')
      .attr('class', 'balloon-dot')
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', 2.5)
      .style('fill', balloon.color)
      .style('stroke', 'none')
      .style('cursor', 'pointer')
      .style('pointer-events', 'auto');
    
    circle.on('click', () => {
      const select = document.getElementById('balloon-select');
      selectedBalloonId = balloon.id;
      if (select) {
        select.value = balloon.id;
        applyBalloonSelectionFromUI();
      }
    });
  });
}

function renderBalloonTrajectoriesSVG() {
  if (!balloonTrajectoriesVisible || !balloonData || !balloonData.length) return;
  const globe = window.currentGlobe;
  if (!globe || !globe.projection) return;
  const projection = globe.projection;

  d3.select('#foreground').selectAll('.balloon-traj').remove();

  const field = (window.fieldAgent && window.fieldAgent.value &&
                 typeof window.fieldAgent.value.isInsideBoundary === 'function')
                ? window.fieldAgent.value
                : null;

  const svg = d3.select('#foreground');

  getVisibleBalloons().forEach(balloon => {
    const projectedPoints = [];
    balloon.points.slice().reverse().forEach(point => {  // now → past (fixes visual)

      // NEW: Orthographic culling
      if (isOrthographic(projection)) {
          const rotate = projection.rotate();
          const center = [-rotate[0], -rotate[1]];
          if (d3.geo.distance(center, [point.lon, point.lat]) > Math.PI / 2) return;
      }

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
       .style('stroke-width', 0.8)
       .style('stroke-linecap', 'round')
       .style('stroke-linejoin', 'round')
       .style('pointer-events', 'none');
  });
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

/* REMOVED for individual balloon rendering
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
*/

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
    toggleBtn.onclick = function () {
      const panel = document.getElementById('balloon-details');
      if (panel) {
        panel.style.display =
          (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
      }
    };
  }

  // Dots checkbox
  const dotsCheckbox = document.getElementById('balloon-dots');
  if (dotsCheckbox) {
    dotsCheckbox.onchange = e => {
      balloonDotsVisible = e.target.checked;
      applyBalloonSelectionFromUI();
    };
  }

  // Trajectories checkbox  <<< DEFINE trajCheckbox HERE
  const trajCheckbox = document.getElementById('show-trajectories');
  if (trajCheckbox) {
    trajCheckbox.onchange = e => {
      balloonTrajectoriesVisible = e.target.checked;

      const select = document.getElementById('balloon-select');

      if (balloonTrajectoriesVisible && selectedBalloonId) {
        // Trajectories turned ON while a balloon is selected:
        // deselect that balloon -> back to all balloons
        selectedBalloonId = null;
        if (select) select.value = '';
      }

      applyBalloonSelectionFromUI();
    };
  }

  // Dropdown
  const select = document.getElementById('balloon-select');
  if (select) {
    select.onchange = e => {
      // "" → null means "All balloons"
      selectedBalloonId = e.target.value || null;
      applyBalloonSelectionFromUI();
    };
  }
}

function applyBalloonSelectionFromUI() {
  const dotsCheckbox  = document.getElementById('balloon-dots');
  const trajCheckbox  = document.getElementById('show-trajectories');

  const dotsOn = dotsCheckbox ? dotsCheckbox.checked : balloonDotsVisible;
  const trajOn = trajCheckbox ? trajCheckbox.checked : balloonTrajectoriesVisible;

  if (!selectedBalloonId) {
    // All balloons mode: honor dots/trajectories as-is
    balloonDotsVisible = dotsOn;
    balloonTrajectoriesVisible = trajOn;
  } else {
    // Filtered mode (one balloon selected)
    if (dotsOn) {
      // Dots checked: we want all dots normal, but only selected trajectory
      balloonDotsVisible = true;
      balloonTrajectoriesVisible = trajOn;   // respect checkbox
    } else {
      // Dots unchecked: only chosen balloon's dot + trajectory when trajOn,
      // or only the dot when trajOff
      balloonDotsVisible = false;
      balloonTrajectoriesVisible = trajOn;
    }
  }

  // Sync checkboxes back to state
  if (dotsCheckbox)  dotsCheckbox.checked  = balloonDotsVisible;
  if (trajCheckbox)  trajCheckbox.checked  = balloonTrajectoriesVisible;

  // Clear SVG and re-render
  const fg = d3.select('#foreground');
  fg.selectAll('.balloon-dot').remove();
  fg.selectAll('.balloon-traj').remove();
  renderBalloons();
}

// Auto-init
window.addEventListener('load', () => {
  initBalloons().then(attachBalloonRenderer);
});
