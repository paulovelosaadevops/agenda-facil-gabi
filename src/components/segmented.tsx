import ExpoSegmentedControl from "@expo/ui/community/segmented-control";
import { View } from "react-native";

/** Controle segmentado nativo (SwiftUI no iOS, Material no Android, web). */
export function Segmented({
  values,
  selectedIndex,
  onChange,
}: {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <ExpoSegmentedControl
        values={values}
        selectedIndex={selectedIndex}
        onChange={(e) => onChange(e.nativeEvent.selectedSegmentIndex)}
      />
    </View>
  );
}
