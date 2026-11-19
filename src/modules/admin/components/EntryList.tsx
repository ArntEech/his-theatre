import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconTile, ListRow, ListSection, type TileColor } from "@/components/List";
import { Money } from "@/components/Money";
import { EmptyNote } from "@/components/States";
import { cx } from "@/lib/cx";

export interface EntryItem {
  id: string;
  title: string;
  meta: string;
  amount: number;
  voided: boolean;
  icon?: LucideIcon;
  color?: TileColor;
}

export function EntryList({
  items,
  onOpen,
  empty,
  header,
  aside,
}: {
  items: EntryItem[];
  onOpen?: (id: string) => void;
  empty: string;
  header?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <ListSection header={header} aside={aside}>
      {items.length === 0 && <EmptyNote>{empty}</EmptyNote>}
      {items.map((item) => (
        <ListRow
          key={item.id}
          onClick={onOpen ? () => onOpen(item.id) : undefined}
          leading={
            item.icon && (
              <IconTile icon={item.icon} color={item.voided ? "gray" : (item.color ?? "gray")} />
            )
          }
          title={item.title}
          subtitle={
            <span className="tnum">
              {item.meta}
              {item.voided && <span className="font-semibold text-destructive"> · Voided</span>}
            </span>
          }
          trailing={
            <Money
              value={item.amount}
              className={cx("text-label", item.voided && "text-label-3 line-through")}
            />
          }
        />
      ))}
    </ListSection>
  );
}
