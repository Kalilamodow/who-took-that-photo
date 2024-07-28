import { useEffect, useState } from "react";
import { View } from "react-native";
import c from "../../ComponentAliases";

function AnimatedEllipses() {
  const [num, setNum] = useState(1);

  useEffect(() => {
    const intervId = setInterval(
      () => setNum(c => (c >= 3 ? 1 : c + 1)),
      300,
    );

    return () => clearInterval(intervId);
  }, []);

  return <>{".".repeat(num)}</>;
}

function LoadingScreen({ otherPlayers }: { otherPlayers: string[] }) {
  return (
    <View
      style={{
        display: "flex",
        flexDirection: "column",
        height: "87.5%",
      }}>
      <c.Header1 cstyle={{ marginTop: 10 }}>Playing With:</c.Header1>
      <c.List
        data={otherPlayers.length > 0 ? otherPlayers : ["Nobody"]}
        keyExtractor={(item, index) => `${item}${index}`}
      />
      <c.Header4>
        Loading
        <AnimatedEllipses />
      </c.Header4>
    </View>
  );
}

export default LoadingScreen;
