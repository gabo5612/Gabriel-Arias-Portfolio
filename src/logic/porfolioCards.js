import images from "./imgPortoflio";

const porfolioCards = [
  {
    img: images.gym,
    title: "GYM App",
    description:
      "Fitness web app with workout tracking, exercise library, and responsive UI built with React.",
    link: "https://github.com/gabo5612/GYM",
    tags: ["React Native", "JavaScript", "CSS"],
  },
  {
    img: images.minuteTips,
    title: "Minute Tips",
    description:
      "Quick-tip content platform featuring clean card-based layout and smooth animations.",
    link: "https://github.com/gabo5612/Minute-Tips",
    tags: ["WordPress", "ACF", "PHP", "SASS"],
  },
  {
    img: images.danielArias,
    title: "Daniel Arias Portfolio",
    description:
      "Personal portfolio site for Daniel Arias — designed and built from scratch with a modern dark aesthetic.",
    link: "https://daniel-arias-portfolio.vercel.app/",
    demo: "https://daniel-arias-portfolio.vercel.app/",
    github: "https://github.com/gabo5612/Daniel-Arias-Portfolio",
    tags: ["React","Next.js", "Framer Motion", "Vercel"],
  },
  {
    img: images.venezuela,
    title: "Venezuela Rutas",
    description:
      "Interactive route-finder app for Venezuela featuring map integration and location-based navigation.",
    link: "https://github.com/gabo5612/Venezuela-Rutas",
    tags: ["JavaScript", "Maps API", "CSS", "WordPress", "ACF"],
  },
  {
    img: images.trailKit,
    title: "TrailKit",
    description:
      "WordPress plugin for adventure routes, POIs & guides — with interactive Leaflet maps, elevation profiles, and a Next.js license management backend.",
    link: "https://trailplugin.com",
    demo: "https://trailplugin.com",
    github: "https://github.com/TrailPlugin/",
    tags: ["WordPress", "PHP", "Leaflet", "Next.js", "Supabase"],
  },
];

export default porfolioCards;
