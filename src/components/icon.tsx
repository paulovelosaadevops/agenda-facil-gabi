import { SymbolView, type SymbolViewProps } from "expo-symbols";

/** Nome semântico → SF Symbol (iOS) e Material Symbol (Android/web). */
const ICONS = {
  home: ["house", "home"],
  calendar: ["calendar", "calendar_month"],
  people: ["person.2", "group"],
  sparkles: ["sparkles", "auto_awesome"],
  gear: ["gearshape", "settings"],
  plus: ["plus", "add"],
  chevronRight: ["chevron.right", "chevron_right"],
  chevronLeft: ["chevron.left", "chevron_left"],
  check: ["checkmark", "check"],
  close: ["xmark", "close"],
  phone: ["phone", "call"],
  message: ["message", "chat"],
  calendarPlus: ["calendar.badge.plus", "calendar_add_on"],
  person: ["person", "person"],
  pencil: ["pencil", "edit"],
  trash: ["trash", "delete"],
  store: ["storefront", "storefront"],
  tag: ["tag", "sell"],
  clock: ["clock", "schedule"],
  calendarOff: ["calendar.badge.minus", "event_busy"],
  calendarClock: ["calendar.badge.clock", "pending_actions"],
  mapPin: ["mappin", "location_on"],
  share: ["square.and.arrow.up", "share"],
  copy: ["doc.on.doc", "content_copy"],
  photo: ["photo.badge.plus", "add_photo_alternate"],
  arrowUp: ["arrow.up", "arrow_upward"],
  refresh: ["arrow.counterclockwise", "refresh"],
  noShow: ["person.crop.circle.badge.xmark", "person_off"],
  cancel: ["xmark.circle", "cancel"],
  reopen: ["arrow.uturn.backward", "undo"],
  logout: ["rectangle.portrait.and.arrow.right", "logout"],
  link: ["link", "link"],
  search: ["magnifyingglass", "search"],
  bell: ["bell", "notifications"],
  bellOn: ["bell.badge", "notifications_active"],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color,
  weight,
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolViewProps["weight"];
}) {
  const [ios, material] = ICONS[name];
  return (
    <SymbolView
      name={{ ios, android: material, web: material }}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
