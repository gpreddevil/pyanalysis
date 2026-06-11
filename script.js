const DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const EMBEDDED_MATCHES = JSON.parse(document.getElementById('matches-data').textContent);
let matches = [...EMBEDDED_MATCHES];

const elements = {
  search: document.getElementById('searchInput'),
  round: document.getElementById('roundFilter'),
  group: document.getElementById('groupFilter'),
  city: document.getElementById('cityFilter'),
  list: document.getElementById('scheduleList'),
  resultCount: document.getElementById('resultCount'),
  dataStatus: document.getElementById('dataStatus'),
  clear: document.getElementById('clearFilters'),
  today: document.getElementById('todayButton'),
  cityGrid: document.getElementById('cityGrid'),
  groupsGrid: document.getElementById('groupsGrid'),
  qualificationStrip: document.getElementById('qualificationStrip'),
  bracket: document.getElementById('bracket'),
  matchCount: document.getElementById('matchCount'),
  cityCount: document.getElementById('cityCount'),
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const todayKey = new Date().toISOString().slice(0, 10);

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function uniqueValues(key) {
  return [...new Set(matches.map((match) => match[key]).filter(Boolean))].sort(collator.compare);
}

function rebuildOptions(select, placeholder, values) {
  const previous = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  select.value = values.includes(previous) ? previous : '';
}

function matchDate(match) {
  return new Date(`${match.date}T12:00:00Z`);
}

function displayDate(match) {
  return dateFormatter.format(matchDate(match));
}

function scoreFor(match) {
  const home = match.score1 ?? match.goals1 ?? match.ft?.[0] ?? match.score?.ft?.[0] ?? match.score?.[0];
  const away = match.score2 ?? match.goals2 ?? match.ft?.[1] ?? match.score?.ft?.[1] ?? match.score?.[1];
  if (Number.isFinite(Number(home)) && Number.isFinite(Number(away))) {
    return { home: Number(home), away: Number(away) };
  }
  return null;
}

function resultLabel(match) {
  const score = scoreFor(match);
  return score ? `${score.home}–${score.away}` : 'Fixture';
}

function normalizedMatchText(match) {
  return [match.round, match.date, match.time, match.team1, match.team2, match.group, match.ground, match.num, resultLabel(match)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function nextMatchIndex() {
  const today = new Date(todayKey);
  const index = matches.findIndex((match) => matchDate(match) >= today);
  return index === -1 ? matches.length - 1 : index;
}

function makeTeamRow(team, index) {
  const topTwoClass = index < 2 ? 'qualifies' : '';
  return `
    <tr class="${topTwoClass}">
      <td><span class="rank">${index + 1}</span> ${escapeHTML(team.name)}</td>
      <td>${team.played}</td>
      <td>${team.won}</td>
      <td>${team.drawn}</td>
      <td>${team.lost}</td>
      <td>${team.goalDifference}</td>
      <td><strong>${team.points}</strong></td>
    </tr>`;
}

function createEmptyTeam(name) {
  return { name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

function groupStandings() {
  const groups = new Map();
  matches.filter((match) => match.group).forEach((match) => {
    if (!groups.has(match.group)) groups.set(match.group, new Map());
    const table = groups.get(match.group);
    [match.team1, match.team2].forEach((team) => {
      if (!table.has(team)) table.set(team, createEmptyTeam(team));
    });

    const score = scoreFor(match);
    if (!score) return;

    const home = table.get(match.team1);
    const away = table.get(match.team2);
    home.played += 1;
    away.played += 1;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;

    if (score.home > score.away) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (score.home < score.away) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  });

  return [...groups.entries()].map(([name, table]) => ({
    name,
    teams: [...table.values()].sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      collator.compare(a.name, b.name)
    ),
  })).sort((a, b) => collator.compare(a.name, b.name));
}

function renderGroups() {
  const groups = groupStandings();
  elements.groupsGrid.innerHTML = groups.map((group) => `
    <article class="group-card">
      <div class="group-card-header">
        <h3>${escapeHTML(group.name)}</h3>
        <span>Top 2 advance</span>
      </div>
      <table>
        <thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${group.teams.map(makeTeamRow).join('')}</tbody>
      </table>
    </article>`).join('');

  elements.qualificationStrip.innerHTML = groups.map((group) => {
    const [winner, runnerUp] = group.teams;
    return `
      <article class="qualifier-card">
        <span>${escapeHTML(group.name)}</span>
        <strong>1. ${escapeHTML(winner?.name || 'TBD')}</strong>
        <strong>2. ${escapeHTML(runnerUp?.name || 'TBD')}</strong>
      </article>`;
  }).join('');
}

function renderKnockout() {
  const stageOrder = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Match for third place', 'Final'];
  const knockouts = matches.filter((match) => !match.group);
  elements.bracket.innerHTML = stageOrder.map((stage) => {
    const stageMatches = knockouts.filter((match) => match.round === stage);
    if (!stageMatches.length) return '';
    return `
      <section class="bracket-stage">
        <h3>${escapeHTML(stage)}</h3>
        <div class="stage-matches">
          ${stageMatches.map((match) => `
            <article class="bracket-match">
              <span class="bracket-date">${escapeHTML(displayDate(match))} · ${escapeHTML(match.time)}</span>
              <div class="bracket-teams">
                <span>${escapeHTML(match.team1)}</span>
                <strong>${escapeHTML(resultLabel(match))}</strong>
                <span>${escapeHTML(match.team2)}</span>
              </div>
              <span class="bracket-venue">${escapeHTML(match.ground)}</span>
            </article>`).join('')}
        </div>
      </section>`;
  }).join('');
}

function renderSchedule() {
  const searchTerm = elements.search.value.trim().toLowerCase();
  const filtered = matches.filter((match) => {
    const matchesSearch = !searchTerm || normalizedMatchText(match).includes(searchTerm);
    const matchesRound = !elements.round.value || match.round === elements.round.value;
    const matchesGroup = !elements.group.value || match.group === elements.group.value;
    const matchesCity = !elements.city.value || match.ground === elements.city.value;
    return matchesSearch && matchesRound && matchesGroup && matchesCity;
  });

  const nextIndex = nextMatchIndex();
  elements.list.innerHTML = filtered.map((match) => {
    const originalIndex = matches.indexOf(match);
    const groupBadge = match.group ? `<span class="badge">${escapeHTML(match.group)}</span>` : '';
    const matchNumber = match.num ? `<span class="badge">Match ${escapeHTML(match.num)}</span>` : '';
    const score = scoreFor(match);
    return `
      <article class="match-card ${originalIndex === nextIndex ? 'next' : ''}" id="match-${originalIndex + 1}">
        <div>
          <span class="date">${escapeHTML(displayDate(match))}</span>
          <span class="time">${escapeHTML(match.time)}</span>
        </div>
        <div>
          <div class="teams">${escapeHTML(match.team1)} <span aria-label="versus">vs</span> ${escapeHTML(match.team2)}</div>
          <div class="meta">${escapeHTML(match.ground)} · ${escapeHTML(match.round)}</div>
        </div>
        <div class="badges">${matchNumber}${groupBadge}<span class="badge ${score ? 'score-badge' : ''}">${escapeHTML(resultLabel(match))}</span><span class="badge">${escapeHTML(match.date)}</span></div>
      </article>`;
  }).join('') || '<p class="meta">No matches found. Try clearing one of the filters.</p>';

  elements.resultCount.textContent = `${filtered.length} of ${matches.length} matches shown`;
}

function renderCities() {
  const counts = matches.reduce((acc, match) => {
    acc[match.ground] = (acc[match.ground] || 0) + 1;
    return acc;
  }, {});
  const cities = Object.entries(counts).sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));
  elements.cityGrid.innerHTML = cities.map(([city, count]) => `
    <article class="city-card">
      <strong>${escapeHTML(city)}</strong>
      <span>${count} match${count === 1 ? '' : 'es'}</span>
    </article>`).join('');
  elements.cityCount.textContent = cities.length;
}

function renderAll() {
  rebuildOptions(elements.round, 'All rounds', uniqueValues('round'));
  rebuildOptions(elements.group, 'All groups', uniqueValues('group'));
  rebuildOptions(elements.city, 'All cities', uniqueValues('ground'));
  elements.matchCount.textContent = matches.length;
  renderCities();
  renderGroups();
  renderKnockout();
  renderSchedule();
}

async function refreshDailyData() {
  const cacheKey = `worldcup-schedule-${todayKey}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      matches = JSON.parse(cached).matches || matches;
      elements.dataStatus.textContent = `Updated today (${todayKey}) from cache`;
      renderAll();
      return;
    }

    const response = await fetch(`${DATA_URL}?day=${todayKey}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.matches) || data.matches.length < 1) throw new Error('No matches in feed');

    matches = data.matches;
    localStorage.setItem(cacheKey, JSON.stringify({ matches, savedAt: new Date().toISOString() }));
    Object.keys(localStorage)
      .filter((key) => key.startsWith('worldcup-schedule-') && key !== cacheKey)
      .forEach((key) => localStorage.removeItem(key));
    elements.dataStatus.textContent = `Updated today (${todayKey}) from live feed`;
    renderAll();
  } catch (error) {
    elements.dataStatus.textContent = `Using embedded fallback · live refresh unavailable`;
    console.info('Daily schedule refresh failed:', error);
  }
}

[elements.search, elements.round, elements.group, elements.city].forEach((control) => {
  control.addEventListener('input', renderSchedule);
});

elements.clear.addEventListener('click', () => {
  elements.search.value = '';
  elements.round.value = '';
  elements.group.value = '';
  elements.city.value = '';
  renderSchedule();
});

elements.today.addEventListener('click', () => {
  const target = document.getElementById(`match-${nextMatchIndex() + 1}`);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

renderAll();
refreshDailyData();
