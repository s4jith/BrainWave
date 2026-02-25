import {
  BookOpen, Calculator, FlaskConical, Leaf, Globe, Languages, Cpu, Music,
  Dumbbell, Palette, Zap, TrendingUp, BookMarked, Microscope, Scale, Activity
} from "lucide-react";

/**
 * Renders an appropriate Lucide icon for a given subject name.
 * Falls back to BookOpen for unknown subjects.
 */
export default function SubjectIcon({ name = "", size = "w-6 h-6", className = "", style = {} }) {
  const n = (name || "").toLowerCase();
  const cls = `${size} ${className}`;
  if (n.includes("math") || n.includes("maths") || n.includes("accountan")) return <Calculator className={cls} style={style} />;
  if (n.includes("physics")) return <Zap className={cls} style={style} />;
  if (n.includes("chem")) return <FlaskConical className={cls} style={style} />;
  if (n.includes("bio")) return <Microscope className={cls} style={style} />;
  if (n.includes("computer") || n.includes("informatics") || n.includes("i.t") || n.match(/\bit\b/)) return <Cpu className={cls} style={style} />;
  if (n.includes("geograph") || n.includes("map")) return <Globe className={cls} style={style} />;
  if (n.includes("histor") || n.includes("civics") || n.includes("political") || n.includes("social")) return <BookMarked className={cls} style={style} />;
  if (n.includes("econom") || n.includes("commerce") || n.includes("business")) return <TrendingUp className={cls} style={style} />;
  if (n.includes("english") || n.includes("hindi") || n.includes("sanskrit") || n.includes("urdu") || n.includes("language")) return <Languages className={cls} style={style} />;
  if (n.includes("art") || n.includes("fine") || n.includes("drawing") || n.includes("craft")) return <Palette className={cls} style={style} />;
  if (n.includes("music")) return <Music className={cls} style={style} />;
  if (n.includes("physical") || n.includes("sport") || n.match(/\bpe\b/) || n.includes("p.e")) return <Activity className={cls} style={style} />;
  if (n.includes("environment") || n.includes("ecology") || n.includes("science") || n.includes("evs")) return <Leaf className={cls} style={style} />;
  if (n.includes("law") || n.includes("legal") || n.includes("justic")) return <Scale className={cls} style={style} />;
  return <BookOpen className={cls} style={style} />;
}
