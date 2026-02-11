interface LanguageSelectorProps {
  lang: "es" | "en";
  onChange: (lang: "es" | "en") => void;
}

const LanguageSelector = ({ lang, onChange }: LanguageSelectorProps) => {
  return (
    <div className="inline-flex items-center rounded-full border-2 border-primary/30 bg-card overflow-hidden text-sm font-bold shadow-sm">
      <button
        onClick={() => onChange("es")}
        className={`px-3 py-1.5 transition-colors ${
          lang === "es"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-primary/10"
        }`}
      >
        ES
      </button>
      <div className="w-px h-5 bg-border" />
      <button
        onClick={() => onChange("en")}
        className={`px-3 py-1.5 transition-colors ${
          lang === "en"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-primary/10"
        }`}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSelector;
