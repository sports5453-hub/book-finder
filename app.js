const questions = [
  "What kind of story sounds right?",
  "What mood do you want after a few chapters?",
  "How should the book move?",
  "Pick the themes that pull you in.",
  "What reading experience fits your schedule?",
  "Any favorite book, author, movie, or topic?",
];

const genreMap = {
  fantasy: ["fantasy", "magic", "mythology"],
  science_fiction: ["science_fiction", "dystopia", "space"],
  mystery: ["mystery", "thriller", "crime"],
  romance: ["romance", "love_stories"],
  historical_fiction: ["historical_fiction", "history"],
  literary_fiction: ["literary_fiction", "fiction"],
  biography: ["biography", "memoir"],
  self_help: ["self_help", "psychology"],
};

const moodMap = {
  cozy: ["cozy", "humor", "friendship", "family"],
  tense: ["suspense", "thriller", "mystery", "crime"],
  wonder: ["adventure", "fantasy", "science_fiction", "nature"],
  emotional: ["drama", "love", "family", "coming_of_age"],
  thoughtful: ["philosophy", "social_life_and_customs", "politics", "science"],
};

const themeMap = {
  adventure: ["adventure", "survival", "journeys"],
  family: ["family", "friendship", "community"],
  power: ["politics", "social_justice", "war", "dystopia"],
  identity: ["coming_of_age", "identity", "young_adult"],
  knowledge: ["science", "technology", "philosophy", "essays"],
  love: ["love", "romance", "relationships"],
};

const paceSubjects = {
  fast: ["thriller", "adventure", "mystery"],
  balanced: ["fiction", "historical_fiction", "memoir"],
  slow: ["literary_fiction", "classics", "philosophy"],
};

const fallbackBooks = [
  {
    title: "The Hobbit",
    author_name: ["J. R. R. Tolkien"],
    first_publish_year: 1937,
    subject: ["fantasy", "adventure", "friendship", "magic"],
    number_of_pages_median: 310,
    ratings_average: 4.3,
    ratings_count: 12000,
    key: "/works/OL27448W",
  },
  {
    title: "The Murder of Roger Ackroyd",
    author_name: ["Agatha Christie"],
    first_publish_year: 1926,
    subject: ["mystery", "crime", "suspense"],
    number_of_pages_median: 288,
    ratings_average: 4.1,
    ratings_count: 6500,
    key: "/works/OL472091W",
  },
  {
    title: "The Left Hand of Darkness",
    author_name: ["Ursula K. Le Guin"],
    first_publish_year: 1969,
    subject: ["science_fiction", "politics", "identity", "philosophy"],
    number_of_pages_median: 304,
    ratings_average: 4.2,
    ratings_count: 9100,
    key: "/works/OL59882W",
  },
];

const form = document.querySelector("#quizForm");
const stepLabel = document.querySelector("#stepLabel");
const stepTitle = document.querySelector("#stepTitle");
const progressBar = document.querySelector("#progressBar");
const backBtn = document.querySelector("#backBtn");
const nextBtn = document.querySelector("#nextBtn");
const resultsSection = document.querySelector("#resultsSection");
const resultsEl = document.querySelector("#results");
const statusEl = document.querySelector("#status");
const restartBtn = document.querySelector("#restartBtn");
const questionEls = [...document.querySelectorAll(".question")];

let step = 0;

function updateStep() {
  questionEls.forEach((el, index) => el.classList.toggle("active", index === step));
  stepLabel.textContent = `Question ${step + 1} of ${questions.length}`;
  stepTitle.textContent = questions[step];
  progressBar.style.width = `${((step + 1) / questions.length) * 100}%`;
  backBtn.disabled = step === 0;
  nextBtn.textContent = step === questions.length - 1 ? "Find books" : "Next";
}

function syncSelectedOptions() {
  document.querySelectorAll(".option").forEach((option) => {
    const input = option.querySelector("input");
    option.classList.toggle("selected", Boolean(input?.checked));
  });
}

function readAnswers() {
  const data = new FormData(form);
  return {
    genres: data.getAll("genre"),
    mood: data.get("mood") || "",
    pace: data.get("pace") || "",
    themes: data.getAll("theme"),
    length: data.get("length") || "",
    inspiration: (data.get("inspiration") || "").trim(),
  };
}

function validateCurrentStep() {
  const fieldset = questionEls[step];
  const inputs = [...fieldset.querySelectorAll("input[type='checkbox'], input[type='radio']")];
  if (!inputs.length) return true;
  return inputs.some((input) => input.checked);
}

function showStatus(message) {
  statusEl.hidden = false;
  statusEl.textContent = message;
}

function hideStatus() {
  statusEl.hidden = true;
  statusEl.textContent = "";
}

function uniqueTerms(answers) {
  const terms = new Set();
  answers.genres.forEach((genre) => (genreMap[genre] || [genre]).forEach((term) => terms.add(term)));
  if (answers.mood) (moodMap[answers.mood] || []).forEach((term) => terms.add(term));
  if (answers.pace) (paceSubjects[answers.pace] || []).forEach((term) => terms.add(term));
  answers.themes.forEach((theme) => (themeMap[theme] || [theme]).forEach((term) => terms.add(term)));
  return [...terms].slice(0, 14);
}

function buildQueries(answers) {
  const terms = uniqueTerms(answers);
  const queryGroups = [];
  if (answers.inspiration) queryGroups.push({ mode: "q", value: answers.inspiration });

  const primaryTerms = [
    ...answers.genres.flatMap((genre) => genreMap[genre] || [genre]),
    ...answers.themes.flatMap((theme) => themeMap[theme] || [theme]),
  ].slice(0, 6);

  if (primaryTerms.length) queryGroups.push({ mode: "subject", value: primaryTerms.join(" ") });
  terms.slice(0, 5).forEach((term) => queryGroups.push({ mode: "subject", value: term }));
  if (!queryGroups.length) queryGroups.push({ mode: "subject", value: "fiction" });
  return queryGroups.slice(0, 7);
}

async function fetchBooks(answers) {
  const queries = buildQueries(answers);
  const requests = queries.map(async ({ mode, value }) => {
    const params = new URLSearchParams({
      limit: "40",
      fields:
        "key,title,author_name,first_publish_year,cover_i,subject,ratings_average,ratings_count,number_of_pages_median,edition_count,language",
    });
    params.set(mode, value);
    const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
    if (!response.ok) throw new Error("Book search failed");
    const payload = await response.json();
    return payload.docs || [];
  });

  const settled = await Promise.allSettled(requests);
  const docs = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return docs.length ? dedupeBooks(docs) : fallbackBooks;
}

function dedupeBooks(books) {
  const seen = new Map();
  books.forEach((book) => {
    const key = book.key || `${book.title}-${book.author_name?.[0] || ""}`;
    const previous = seen.get(key);
    if (!previous || metadataScore(book) > metadataScore(previous)) seen.set(key, book);
  });
  return [...seen.values()];
}

function metadataScore(book) {
  return (
    (book.cover_i ? 20 : 0) +
    (book.author_name?.length ? 12 : 0) +
    (book.subject?.length ? 10 : 0) +
    Math.min(book.ratings_count || 0, 5000) / 250
  );
}

function scoreBook(book, answers) {
  const subjects = (book.subject || []).map(normalize);
  const title = normalize(book.title || "");
  const author = normalize((book.author_name || []).join(" "));
  const haystack = `${title} ${author} ${subjects.join(" ")}`;
  const desiredTerms = uniqueTerms(answers).map(normalize);

  let score = 0;
  const reasons = [];
  const matchedTerms = desiredTerms.filter((term) => haystack.includes(term));
  score += Math.min(matchedTerms.length, 8) * 9;
  if (matchedTerms.length) reasons.push(`Matches ${humanizeList(matchedTerms.slice(0, 3))}`);

  if (answers.inspiration) {
    const inspirationTerms = normalize(answers.inspiration)
      .split(" ")
      .filter((term) => term.length > 2);
    const inspirationHits = inspirationTerms.filter((term) => haystack.includes(term)).length;
    score += Math.min(inspirationHits, 4) * 8;
    if (inspirationHits) reasons.push("Connects with your inspiration");
  }

  const pageCount = book.number_of_pages_median || 0;
  if (answers.length && pageCount) {
    const lengthFit =
      (answers.length === "short" && pageCount <= 280) ||
      (answers.length === "medium" && pageCount > 220 && pageCount <= 520) ||
      (answers.length === "long" && pageCount >= 420);
    score += lengthFit ? 14 : 2;
    if (lengthFit) reasons.push(`Fits your ${answers.length} length preference`);
  }

  const rating = Number(book.ratings_average || 0);
  const ratingCount = Number(book.ratings_count || 0);
  if (rating) score += Math.min(rating, 5) * 5;
  score += Math.min(ratingCount, 10000) / 800;
  if (rating >= 4) reasons.push("Strong reader ratings");

  if (book.cover_i) score += 5;
  if (book.first_publish_year) score += book.first_publish_year > 2000 ? 4 : 2;
  if ((book.edition_count || 0) > 10) score += 4;

  return {
    ...book,
    matchScore: Math.round(Math.min(score, 100)),
    reasons: reasons.length ? reasons.slice(0, 3) : ["A broad match based on your reading profile"],
  };
}

function normalize(value) {
  return String(value).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
}

function humanize(value) {
  return value.replaceAll("_", " ");
}

function humanizeList(values) {
  return values.map(humanize).join(", ");
}

function rankBooks(books, answers) {
  return books
    .filter((book) => book.title && book.author_name?.length)
    .filter((book) => !book.language || book.language.includes("eng"))
    .map((book) => scoreBook(book, answers))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 12);
}

function coverMarkup(book) {
  if (book.cover_i) {
    return `<img class="book-cover" src="https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg" alt="Cover of ${escapeHtml(book.title)}" loading="lazy" />`;
  }
  return `<div class="book-cover fallback-cover" aria-hidden="true">${escapeHtml(book.title)}</div>`;
}

function renderResults(books) {
  resultsEl.innerHTML = books
    .map((book, index) => {
      const author = (book.author_name || []).slice(0, 2).join(", ");
      const year = book.first_publish_year || "Year unknown";
      const pages = book.number_of_pages_median ? `${book.number_of_pages_median} pages` : "Length varies";
      const rating = book.ratings_average ? `${Number(book.ratings_average).toFixed(1)} stars` : "Rating unavailable";
      const url = book.key ? `https://openlibrary.org${book.key}` : "https://openlibrary.org";

      return `
        <article class="book-card">
          ${coverMarkup(book)}
          <div class="book-meta">
            <div class="rank-row">
              <span class="rank">#${index + 1}</span>
              <span class="score">${book.matchScore}% match</span>
            </div>
            <h3>${escapeHtml(book.title)}</h3>
            <p class="author">${escapeHtml(author)}</p>
            <p class="details">${year} | ${pages} | ${rating}</p>
            <p class="reasons">${escapeHtml(book.reasons.join(". "))}</p>
            <a class="book-link" href="${url}" target="_blank" rel="noreferrer">View book</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

async function findMatches() {
  const answers = readAnswers();
  resultsSection.classList.add("visible");
  resultsEl.innerHTML = "";
  showStatus("Searching a large public book catalog and ranking the strongest matches...");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const books = await fetchBooks(answers);
    const ranked = rankBooks(books, answers);
    if (!ranked.length) {
      renderResults(rankBooks(fallbackBooks, answers));
      showStatus("The live catalog did not return enough clean matches, so these are starter recommendations.");
      return;
    }
    hideStatus();
    renderResults(ranked);
  } catch (error) {
    renderResults(rankBooks(fallbackBooks, answers));
    showStatus("The live catalog could not be reached. These are offline starter recommendations.");
  }
}

nextBtn.addEventListener("click", () => {
  if (!validateCurrentStep()) {
    showStatus("Choose at least one answer before moving on.");
    questionEls[step].scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  hideStatus();
  if (step < questions.length - 1) {
    step += 1;
    updateStep();
    return;
  }
  findMatches();
});

backBtn.addEventListener("click", () => {
  if (step > 0) {
    step -= 1;
    hideStatus();
    updateStep();
  }
});

restartBtn.addEventListener("click", () => {
  form.reset();
  step = 0;
  updateStep();
  syncSelectedOptions();
  hideStatus();
  resultsEl.innerHTML = "";
  resultsSection.classList.remove("visible");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

form.addEventListener("change", syncSelectedOptions);

updateStep();
syncSelectedOptions();
