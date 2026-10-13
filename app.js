/* Shared logic for every HAIMN page: tracks, profile storage, matching, sending data. */
(function () {
  var BUCKETS = {
    academic: {
      key: "academic",
      area: "Academic Coursework",
      track: "Academic Track",
      blurb: "Help with courses, homework and studying.",
      features: [
        "Ask for courses & syllabus",
        "Upload slides & homework",
        "AI tutor + quiz generator",
        "Study planner unlocked"
      ],
      starters: [
        "Explain this week's lecture slides in simple terms",
        "Make a practice quiz from my homework",
        "Build me a study plan for the next two weeks"
      ],
      group: "academic"
    },
    career: {
      key: "career",
      area: "Career & Job Search",
      track: "Career Track",
      blurb: "Help with resumes, interviews and finding jobs.",
      features: [
        "Ask for resume / goals",
        "Interview prep module",
        "Job search guidance",
        "Career AI coach unlocked"
      ],
      starters: [
        "Review my resume for a software internship",
        "Run a mock interview for a marketing role",
        "Which companies hire new graduates in my field?"
      ],
      group: "career"
    },
    technical: {
      key: "technical",
      area: "Coding & Technical",
      track: "Technical Track",
      blurb: "Help with programming, debugging and algorithms.",
      features: [
        "Ask for languages / stack",
        "Code review + debugging",
        "Algorithm explanations",
        "Dev-focused peers surfaced"
      ],
      starters: [
        "Why does my Python loop never stop?",
        "Explain how binary search trees work",
        "Review my project structure before I submit it"
      ],
      group: "technical"
    },
    productivity: {
      key: "productivity",
      area: "Productivity & Life",
      track: "Productivity Track",
      blurb: "Help with daily goals, habits and staying organized.",
      features: [
        "Ask about daily goals",
        "Task & habit AI coaching",
        "Personal organization tools",
        "Lifestyle peers surfaced"
      ],
      starters: [
        "Plan my week around classes and a part-time job",
        "Help me build a habit of studying every evening",
        "How do I stop procrastinating on big assignments?"
      ],
      group: "general"
    },
    exploration: {
      key: "exploration",
      area: "Unfamiliar / Unsure",
      track: "Guided Exploration",
      blurb: "Not sure yet? We will walk you through everything.",
      features: [
        "AI walks user through each feature area",
        "Soft re-survey after 3 sessions",
        "Auto-re-bucket when ready"
      ],
      starters: [
        "What can HAIMN help me with?",
        "Show me how the career and study tools work",
        "I am not sure what I need. Where should I start?"
      ],
      group: "all"
    }
  };
  var ORDER = ["academic", "career", "technical", "productivity", "exploration"];

  var GROUPS = {
    academic: {
      title: "Academic Groups", cls: "b-academic",
      by: "By Major · By Course · By Study Style",
      examples: ["CS Majors", "Pre-Med", "Research Students"]
    },
    career: {
      title: "Career / Industry Groups", cls: "b-career",
      by: "By Field · By Goal · By Hiring Timeline",
      examples: ["Tech Recruiters", "New Grads", "Finance"]
    },
    technical: {
      title: "Technical Communities", cls: "b-technical",
      by: "By Stack · Language · By Project Type",
      examples: ["Web Dev", "ML / AI", "Open Source"]
    },
    general: {
      title: "General / Lifestyle", cls: "b-productivity",
      by: "Productivity · Wellness",
      examples: ["Entrepreneurship", "First-Gen Students"]
    }
  };

  var KEYWORDS = {
    academic: ["course", "class", "homework", "assignment", "exam", "study", "syllabus", "professor", "grade", "gpa",
      "quiz", "lecture", "thesis", "research", "tutor", "math", "calculus", "essay", "paper", "school", "semester"],
    career: ["resume", "cv", "job", "career", "intern", "interview", "hire", "hiring", "recruiter", "offer", "linkedin",
      "salary", "employer", "work experience", "portfolio", "cover letter"],
    technical: ["code", "coding", "program", "python", "java", "javascript", "debug", "algorithm", "software", "developer",
      "github", "web", "app", "data structure", "machine learning", "ml", "sql", "api", "computer science", "cs"],
    productivity: ["schedule", "time management", "habit", "organi", "planner", "productiv", "routine", "task", "balance",
      "wellness", "stress", "budget", "sleep", "focus", "motivat", "procrastinat", "daily"]
  };

  var KEY = "haimn_profile";

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function saveProfile(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; }
  }
  function clearProfile() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  // Keyword matching that stands in for the "AI analyzes survey responses" step.
  function matchBucket(text) {
    var t = String(text || "").toLowerCase();
    var best = null, bestScore = 0;
    ORDER.forEach(function (k) {
      if (!KEYWORDS[k]) return;
      var score = 0;
      KEYWORDS[k].forEach(function (kw) {
        if (new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t)) score++;
      });
      if (score > bestScore) { best = k; bestScore = score; }
    });
    return best || "exploration";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Sends one record to the Google Apps Script web app (or stores it locally in demo mode).
  function send(payload) {
    var url = window.HAIMN_ENDPOINT;
    if (!url) {
      try {
        var box = JSON.parse(localStorage.getItem("haimn_demo_outbox") || "[]");
        var copy = {};
        Object.keys(payload).forEach(function (k) { copy[k] = k === "resume_base64" ? "(file data)" : payload[k]; });
        box.push(copy);
        localStorage.setItem("haimn_demo_outbox", JSON.stringify(box));
      } catch (e) { /* storage unavailable */ }
      return Promise.resolve({ ok: true, demo: true });
    }
    // A plain-text body avoids a CORS preflight, which Apps Script cannot answer.
    return fetch(url, { method: "POST", body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (out) {
        if (!out.ok) throw new Error(out.error || "Request failed");
        return out;
      });
  }

  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1]); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // Shared form helpers -------------------------------------------------
  function validateCards(form) {
    var ok = true;
    form.querySelectorAll(".card[data-required]").forEach(function (card) {
      var valid;
      var text = card.querySelector('input[type="text"], input[type="email"], input[type="tel"], select');
      if (text && !card.querySelector('input[type="radio"]')) {
        var v = text.value.trim();
        valid = v !== "";
        if (valid && card.dataset.type === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      } else {
        valid = !!card.querySelector('input[type="radio"]:checked');
      }
      card.classList.toggle("invalid", !valid);
      if (!valid) ok = false;
    });
    return ok;
  }
  function wireForm(form) {
    form.addEventListener("input", function (e) {
      var c = e.target.closest(".card.invalid");
      if (c) c.classList.remove("invalid");
    });
    form.addEventListener("change", function (e) {
      var c = e.target.closest(".card.invalid");
      if (c) c.classList.remove("invalid");
    });
    form.querySelectorAll(".other-input").forEach(function (box) {
      box.addEventListener("input", function () {
        box.closest(".opt").querySelector('input[type="radio"]').checked = true;
      });
    });
  }
  function radioValue(form, name, otherName) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    if (!el) return "";
    if (el.value === "__other__") {
      var o = form.querySelector('input[name="' + otherName + '"]');
      return "Other: " + (o ? o.value.trim() : "");
    }
    return el.value;
  }

  window.HAIMN = {
    BUCKETS: BUCKETS, ORDER: ORDER, GROUPS: GROUPS,
    getProfile: getProfile, saveProfile: saveProfile, clearProfile: clearProfile,
    matchBucket: matchBucket, esc: esc, send: send, readBase64: readBase64,
    validateCards: validateCards, wireForm: wireForm, radioValue: radioValue
  };
})();
