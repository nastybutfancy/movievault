import { state } from "./state-302.js";
import { $, escapeHtml, normalizeBarcode, showView } from "./utils-302.js";
import { openMovie, setCollectionFormat, renderCollection } from "./collection-302.js";

let dailyMovie = null;
let rouletteMovie = null;

const timestamp = movie => new Date(movie.addedAt || movie.dateAdded || movie.date || 0).getTime() || 0;
const metadata = value => String(value || "").toLowerCase();

function movieCard(movie) {
  const code = normalizeBarcode(movie.barcode);
  return `<button class="home-poster-card" data-home-movie="${escapeHtml(code)}" type="button">
    <span class="home-poster-art">${movie.poster ? `<img src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title || 'Film')}" loading="lazy">` : '<span class="poster-placeholder">🎬</span>'}<em>${escapeHtml(movie.format || 'Film')}</em></span>
    <strong>${escapeHtml(movie.title || 'Bez tytułu')}</strong><small>${escapeHtml(movie.year || '—')}</small>
  </button>`;
}

function fillRow(id, movies) {
  $(id).innerHTML = movies.length ? movies.map(movieCard).join('') : '<div class="home-row-empty">Ta półka czeka na pierwsze filmy.</div>';
}

function bindCards() {
  document.querySelectorAll('[data-home-movie]').forEach(button => button.onclick = () => openMovie(button.dataset.homeMovie));
}

export function renderHome() {
  const movies = state.movies || [];
  const today = new Date();
  dailyMovie = movies.length ? movies[Math.abs(Number(`${today.getFullYear()}${today.getMonth()+1}${today.getDate()}`)) % movies.length] : null;

  const ratings = movies.map(m => Number.parseFloat(m.voteAverage)).filter(Number.isFinite);
  $('ratingStat').textContent = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : '—';

  const hero = $('dailyHero');
  if (dailyMovie) {
    hero.style.backgroundImage = `url("${dailyMovie.backdrop || dailyMovie.poster || ''}")`;
    $('dailyDescription').textContent = `${dailyMovie.title || 'Film dnia'}${dailyMovie.year ? ` • ${dailyMovie.year}` : ''}${dailyMovie.description ? ` — ${dailyMovie.description.slice(0,180)}${dailyMovie.description.length > 180 ? '…' : ''}` : ''}`;
    $('dailyOpenButton').disabled = false;
  } else {
    $('dailyDescription').textContent = 'Dodaj pierwszy film, a MovieVault przygotuje dla Ciebie codzienną propozycję.';
    $('dailyOpenButton').disabled = true;
  }

  fillRow('homeRecentRow', [...movies].sort((a,b)=>timestamp(b)-timestamp(a)).slice(0,12));
  fillRow('homeHorrorRow', movies.filter(m => /horror|thriller|groza|kryminał/.test(metadata(m.genres))).slice(0,14));
  fillRow('homeHdRow', movies.filter(m => /blu|4k|uhd/.test(metadata(m.format))).slice(0,14));
  bindCards();
}

export function setupHome() {
  $('dailyOpenButton').onclick = () => dailyMovie && openMovie(dailyMovie.barcode);
  $('rouletteButton').onclick = openRoulette;
  $('closeRouletteButton').onclick = () => $('rouletteDialog').close();
  $('spinRouletteButton').onclick = spinRoulette;
  $('openRouletteMovieButton').onclick = () => { if (rouletteMovie) { $('rouletteDialog').close(); openMovie(rouletteMovie.barcode); } };
  $('rouletteDialog').onclick = event => { if (event.target === $('rouletteDialog')) $('rouletteDialog').close(); };

  const search = () => {
    $('collectionFilter').value = $('homeSearchInput').value.trim();
    setCollectionFormat('all');
    showView('collectionView');
    renderCollection();
  };
  $('homeSearchButton').onclick = search;
  $('homeSearchInput').onkeydown = e => { if (e.key === 'Enter') search(); };

  document.querySelectorAll('[data-home-format]').forEach(button => button.onclick = () => {
    showView('collectionView'); setCollectionFormat(button.dataset.homeFormat);
  });
}

function openRoulette() {
  rouletteMovie = null;
  $('rouletteReel').innerHTML = '<div class="roulette-placeholder">🎬</div>';
  $('rouletteResult').innerHTML = '<strong>Kliknij i zdaj się na MovieVault</strong><span>Losujemy wyłącznie z Twojej kolekcji.</span>';
  $('openRouletteMovieButton').classList.add('hidden');
  $('rouletteDialog').showModal();
}

function spinRoulette() {
  const movies = state.movies || [];
  if (!movies.length) { $('rouletteResult').innerHTML = '<strong>Twoja półka jest jeszcze pusta</strong><span>Najpierw dodaj film do kolekcji.</span>'; return; }
  const button = $('spinRouletteButton'); button.disabled = true;
  let ticks = 0;
  const timer = setInterval(() => {
    const movie = movies[Math.floor(Math.random()*movies.length)];
    $('rouletteReel').innerHTML = movie.poster ? `<img src="${escapeHtml(movie.poster)}" alt="">` : '<div class="roulette-placeholder">🎬</div>';
    ticks++;
    if (ticks >= 18) {
      clearInterval(timer); rouletteMovie = movies[Math.floor(Math.random()*movies.length)];
      $('rouletteReel').innerHTML = rouletteMovie.poster ? `<img class="roulette-winner" src="${escapeHtml(rouletteMovie.poster)}" alt="${escapeHtml(rouletteMovie.title || '')}">` : '<div class="roulette-placeholder roulette-winner">🎬</div>';
      $('rouletteResult').innerHTML = `<strong>${escapeHtml(rouletteMovie.title || 'Dzisiejszy wybór')}</strong><span>${escapeHtml(rouletteMovie.year || '')}${rouletteMovie.format ? ` • ${escapeHtml(rouletteMovie.format)}` : ''}</span>`;
      $('openRouletteMovieButton').classList.remove('hidden'); button.disabled = false; button.textContent = '🎲 Losuj ponownie';
    }
  }, 85);
}
