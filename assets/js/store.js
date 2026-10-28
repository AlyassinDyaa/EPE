/* East Park Entertainment — tiny data store shared by the public site and the admin dashboard.
   Data lives in localStorage so changes made in the dashboard show up on the site instantly
   (same browser). Swap load/save for API calls when a backend is added. */
(function () {
  "use strict";

  const KEY = "epe:data:v1";

  const ROLES = {
    creator: "Comic creator",
    author: "Author",
    artist: "Artist",
    writer: "Writer",
    shop: "Comic shop",
  };

  const COLORS = ["yellow", "red", "blue", "mint", "violet"];

  const seed = {
    settings: {
      announcement: "New episode: Mara Okonkwo on drawing Lagos at 3am",
      showAnnouncement: true,
      followers: 48200,
      subscribers: 3120,
    },
    interviews: [
      {
        id: "i1", name: "Mara Okonkwo", role: "creator", location: "Lagos, Nigeria",
        title: "Drawing Lagos at 3am", date: "2026-10-14", readTime: 9, color: "yellow", status: "published", featured: true,
        excerpt: "The creator of Night Market on the city's after-hours rhythm, selling her first zines at a bus stop, and why every page starts with a sound.",
        quote: "Lagos never sleeps, so neither do my panels.",
        tags: ["Webcomics", "Slice of life", "Self-published"],
        qa: [
          { q: "Night Market started as a zine. What was the first print run like?", a: "Forty copies, stapled by hand on my kitchen floor. I sold them at a bus stop in Yaba and the last one went to a conductor who still messages me about new chapters." },
          { q: "You say every page starts with a sound. What does that mean?", a: "Before I sketch, I write down what the scene sounds like. Generators, a radio two streets away, someone laughing. If I can hear it, the reader can see it." },
          { q: "Advice for creators who are just starting?", a: "Finish small things. A finished four-page story teaches you more than a forty-page plan." },
        ],
      },
      {
        id: "i2", name: "Theo Lindqvist", role: "artist", location: "Malmö, Sweden",
        title: "The ink remembers everything", date: "2026-10-02", readTime: 7, color: "blue", status: "published", featured: false,
        excerpt: "An inker with two decades in the gutter talks brushes, mistakes worth keeping, and the quiet craft most readers never notice.",
        quote: "A good inker is invisible. A great one makes you feel the weather.",
        tags: ["Inking", "Craft", "Process"],
        qa: [
          { q: "Brush or pen?", a: "Brush for anything alive, pen for anything built. Faces get a brush. Buildings get a pen." },
          { q: "What's a mistake you kept?", a: "A wobbly line on a rooftop in my first published book. The editor wanted it fixed. I said it was wind. It stayed." },
        ],
      },
      {
        id: "i3", name: "Priya Raman", role: "writer", location: "Toronto, Canada",
        title: "Writing silence into a speech bubble", date: "2026-09-21", readTime: 11, color: "red", status: "published", featured: false,
        excerpt: "How the writer behind Monsoon Letters uses empty balloons, long pauses and the space between panels to say the loudest things.",
        quote: "The empty balloon is the most honest line in the book.",
        tags: ["Scripting", "Drama", "Graphic novels"],
        qa: [
          { q: "Your scripts are famous for wordless pages. Why?", a: "Because grief doesn't talk much. I trust the artist to carry the moment, and I trust the reader to sit in it." },
          { q: "How do you collaborate with artists?", a: "I write the feeling first and the camera second. Then I get out of the way." },
        ],
      },
      {
        id: "i4", name: "Juniper Hale", role: "author", location: "Portland, USA",
        title: "A memoir in four colours", date: "2026-09-08", readTime: 8, color: "mint", status: "published", featured: false,
        excerpt: "The author of Small Weather on turning a family story into a graphic memoir, and why she limited herself to only four colours.",
        quote: "Limits aren't walls. They're the frame you hang the picture in.",
        tags: ["Memoir", "Colour", "Indie"],
        qa: [
          { q: "Why four colours?", a: "Each one is a person in my family. When two colours mix on a page, those people are in the room together." },
          { q: "Was it hard to share something so personal?", a: "Terrifying. Then a reader wrote to say she'd called her brother for the first time in six years. That made it worth it." },
        ],
      },
      {
        id: "i5", name: "Panel & Pulp Comics", role: "shop", location: "Glasgow, Scotland",
        title: "The shop with a Tuesday drawing club", date: "2026-08-27", readTime: 6, color: "violet", status: "published", featured: false,
        excerpt: "Owners Callum and Aisha on running an indie shop that doubles as a community studio, and why their back room is never empty.",
        quote: "We sell comics, but really we sell Tuesdays.",
        tags: ["Community", "Indie shop", "Events"],
        qa: [
          { q: "How did the drawing club start?", a: "Three regulars kept sketching at the counter. We gave them a table. Now it's thirty people and we've run out of chairs twice." },
          { q: "What's selling right now?", a: "Local small-press anthologies. People want to read their neighbours." },
        ],
      },
      {
        id: "i6", name: "Kenji Arata", role: "creator", location: "Osaka, Japan",
        title: "From phone screen to paper", date: "2026-08-12", readTime: 10, color: "red", status: "published", featured: false,
        excerpt: "A vertical-scroll webcomic hit two million readers. Kenji explains what changed when it had to fit on a printed page.",
        quote: "Scrolling is a river. A page is a room. I had to learn to build rooms.",
        tags: ["Webcomics", "Manga", "Print"],
        qa: [
          { q: "What was hardest about the print adaptation?", a: "Pacing. On a phone, the reveal is one swipe away. On paper, it's a page turn, so the whole chapter had to be re-timed." },
        ],
      },
      {
        id: "i7", name: "Sofía Beltrán", role: "artist", location: "Mexico City, Mexico",
        title: "Colour is a plot device", date: "2026-09-02", readTime: 7, color: "yellow", status: "published", featured: false,
        excerpt: "The colourist reshaping how a scene feels on the page, from sunset palettes to the shade of green that means danger.",
        quote: "Readers don't notice colour. They feel it. That's the trick.",
        tags: ["Colouring", "Craft"],
        qa: [
          { q: "Do you read the script before colouring?", a: "Twice. Once for the story, once only for the light: what time it is, what the weather is, who's lying." },
        ],
      },
      {
        id: "i8", name: "The Gutter Space", role: "shop", location: "Melbourne, Australia",
        title: "A comic shop built like a library", date: "2026-07-16", readTime: 5, color: "mint", status: "published", featured: false,
        excerpt: "A reading-room-first shop where you can sit with any book for an hour before you buy it, and why sales went up.",
        quote: "Let people read. They'll come back to buy.",
        tags: ["Indie shop", "Reading room"],
        qa: [
          { q: "Didn't people worry you'd lose sales?", a: "Everyone. Our accountant most of all. Turns out people buy what they've fallen for, and we gave them time to fall." },
        ],
      },
      {
        id: "i9", name: "Dele Mensah", role: "writer", location: "Accra, Ghana",
        title: "Heroes who look like home", date: "2026-11-04", readTime: 8, color: "blue", status: "scheduled", featured: false,
        excerpt: "The editor of the Sankofa anthology on building a superhero universe rooted in West African folklore.",
        quote: "Our myths had capes long before the capes had names.",
        tags: ["Anthology", "Superheroes", "Folklore"],
        qa: [{ q: "Where did the anthology begin?", a: "With my grandmother's stories and a group chat of twelve artists." }],
      },
      {
        id: "i10", name: "Inès Moreau", role: "author", location: "Lyon, France",
        title: "Bandes dessinées and the long game", date: "2026-11-18", readTime: 9, color: "violet", status: "draft", featured: false,
        excerpt: "A thirty-year career in French comics, and what changes, and what doesn't, when you write for the same readers for decades.",
        quote: "My first readers are now grandparents. They bring the grandchildren.",
        tags: ["BD", "Career"],
        qa: [],
      },
    ],
    shops: [
      { id: "s1", name: "Panel & Pulp Comics", city: "Glasgow", country: "Scotland", specialty: "Small press & drawing club", color: "violet" },
      { id: "s2", name: "The Gutter Space", city: "Melbourne", country: "Australia", specialty: "Reading-room shop", color: "mint" },
      { id: "s3", name: "Kitsune Books", city: "Osaka", country: "Japan", specialty: "Manga & doujinshi", color: "red" },
      { id: "s4", name: "Brick Lane Bubbles", city: "London", country: "England", specialty: "Zines & risograph", color: "yellow" },
      { id: "s5", name: "Casa Viñeta", city: "Mexico City", country: "Mexico", specialty: "Latin American comics", color: "blue" },
      { id: "s6", name: "Harbour Ink", city: "Halifax", country: "Canada", specialty: "Indie graphic novels", color: "mint" },
      { id: "s7", name: "Lagoon Comics", city: "Lagos", country: "Nigeria", specialty: "African webcomics in print", color: "yellow" },
      { id: "s8", name: "Bulle d'Encre", city: "Lyon", country: "France", specialty: "Bandes dessinées", color: "red" },
    ],
    submissions: [
      { id: "sub1", name: "Ravi Desai", email: "ravi@example.com", role: "creator", link: "https://example.com/ravi", message: "I make a weekly webcomic about a lighthouse keeper's cat. 140 strips so far, printing a first collection next spring.", date: "2026-10-25", status: "new" },
      { id: "sub2", name: "Comix Corner", email: "hello@example.com", role: "shop", link: "", message: "Family-run shop in Austin for 22 years. We host a monthly swap meet and run a free kids' comic-making class.", date: "2026-10-22", status: "new" },
      { id: "sub3", name: "Lena Brandt", email: "lena@example.com", role: "artist", link: "https://example.com/lena", message: "Cover artist and letterer, recently finished a 6-issue horror mini-series.", date: "2026-10-12", status: "approved" },
    ],
    activity: [
      { t: "2026-10-25T10:12:00", text: "New submission from Ravi Desai" },
      { t: "2026-10-22T16:40:00", text: "New submission from Comix Corner" },
      { t: "2026-10-14T09:00:00", text: "Published “Drawing Lagos at 3am”" },
      { t: "2026-10-02T09:00:00", text: "Published “The ink remembers everything”" },
    ],
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  let cache = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage blocked: fall back to seed */ }
    return clone(seed);
  }

  function get() {
    if (!cache) cache = load();
    return cache;
  }

  function save(data) {
    cache = data;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* in-memory only */ }
    window.dispatchEvent(new CustomEvent("epe:change"));
  }

  function update(fn) {
    const data = get();
    fn(data);
    save(data);
  }

  function log(text) {
    update((d) => {
      d.activity.unshift({ t: new Date().toISOString(), text });
      d.activity = d.activity.slice(0, 40);
    });
  }

  function reset() { save(clone(seed)); }

  const uid = (p) => p + Math.random().toString(36).slice(2, 9);

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const initials = (name) => String(name).split(/\s+/).filter((w) => /^[\p{L}]/u.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const fmtDate = (iso, opts = { day: "numeric", month: "short", year: "numeric" }) => {
    const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, opts);
  };

  // Another tab (e.g. the dashboard) changed the data: refresh.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { cache = null; window.dispatchEvent(new CustomEvent("epe:change")); }
  });

  window.EPE = { get, save, update, log, reset, uid, esc, initials, fmtDate, ROLES, COLORS };
})();
