import { THEMES, useTheme, type ThemePreference } from "@/lib/theme";
import { useTextSize, type TextSize } from "@/lib/textSize";
import { FONTS, useFont, type FontChoice } from "@/lib/font";
import { cx } from "@/lib/cx";
import { PageHeader } from "@/components/PageHeader";
import { Segmented, SelectField, Switch } from "@/components/Field";
import { ListItem, ListRow, ListSection } from "@/components/List";

/** Looks, eye care, text size and font. Saved on this phone only. */
export function PersonalizationPage() {
  const theme = useTheme();
  const text = useTextSize();
  const font = useFont();
  return (
    <>
      <PageHeader title="Personalization" back={{ to: "/settings", label: "Settings" }} />
      <ListSection header="Look" footer="Automatic follows your phone: Day in daylight, Night at night.">
        <ListItem>
          <ThemePicker value={theme.preference} onChange={theme.setPreference} />
        </ListItem>
      </ListSection>
      <ListSection footer="A warm filter that works with any look. Kinder to your eyes at night.">
        <ListRow
          title="Eye care"
          trailing={<Switch label="Eye care" checked={theme.eyeCare} onChange={theme.setEyeCare} />}
        />
      </ListSection>
      <ListSection header="Text" footer="M is the standard size. These choices are saved on this phone only.">
        <ListItem>
          <Segmented<TextSize>
            label="Text size"
            value={text.size}
            onChange={text.setSize}
            options={[
              { value: "smaller", label: "XS" },
              { value: "small", label: "S" },
              { value: "standard", label: "M" },
              { value: "large", label: "L" },
              { value: "larger", label: "XL" },
            ]}
          />
        </ListItem>
        <ListItem>
          <SelectField
            label="Font"
            value={font.font}
            onChange={(e) => font.setFont(e.target.value as FontChoice)}
          >
            {(Object.keys(FONTS) as FontChoice[]).map((key) => (
              <option key={key} value={key}>
                {FONTS[key].label}
              </option>
            ))}
          </SelectField>
        </ListItem>
      </ListSection>
    </>
  );
}

/** Small previews of each look, as in iOS Settings → Wallpaper. */
const SWATCH: Record<ThemePreference, string> = {
  system: "linear-gradient(135deg, #fbf8f1 50%, #343434 50%)",
  day: "#fbf8f1",
  night: "#343434",
  dark: "#000000",
  clear:
    "radial-gradient(70% 60% at 20% 20%, #c8782f, transparent 70%), radial-gradient(60% 60% at 80% 80%, #2f6b6b, transparent 70%), #2a1f1a",
  blur: "radial-gradient(90% 80% at 30% 30%, #9a6a4c, transparent 80%), #4a3428",
  frosted:
    "radial-gradient(80% 70% at 30% 25%, #b9907a, transparent 75%), radial-gradient(70% 70% at 80% 80%, #7d5e6a, transparent 75%), #5c4a44",
};

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (t: ThemePreference) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Look" className="grid w-full grid-cols-4 gap-x-2 gap-y-3 py-1 sm:grid-cols-7">
      {THEMES.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={t.hint}
            onClick={() => onChange(t.value)}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span
              className={cx(
                "relative block aspect-[3/4] w-full max-w-[4rem] overflow-hidden rounded-[0.75rem] ring-[0.5px] ring-separator",
                selected && "ring-[2.5px] ring-tint",
              )}
              style={{ background: SWATCH[t.value] }}
            >
              {(t.value === "clear" || t.value === "blur" || t.value === "frosted") && (
                <span
                  className="absolute inset-x-1.5 bottom-1.5 h-1/3 rounded-[0.4rem] border border-white/30"
                  style={{
                    background:
                      t.value === "clear"
                        ? "rgb(255 255 255 / 0.08)"
                        : t.value === "blur"
                          ? "rgb(58 42 34 / 0.5)"
                          : "rgb(255 255 255 / 0.2)",
                    backdropFilter: `blur(${t.value === "clear" ? 2 : t.value === "blur" ? 10 : 6}px)`,
                  }}
                />
              )}
            </span>
            <span
              className={cx(
                "text-caption",
                selected ? "font-semibold text-tint-text" : "text-label-2",
              )}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

