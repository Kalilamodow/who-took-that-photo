import { Image, View } from "react-native";
import c from "../../ComponentAliases";

import { StyleSheet } from "react-native";

type RoundViewParams = {
  image: string;
  peopleChoices: string[];
  onPersonSelected: (name: string) => any;
};

const styles = StyleSheet.create({
  main: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  image: {
    borderColor: "white",
    borderWidth: 1,
    borderRadius: 10,
  },
  choices: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  choiceButtonOuter: {
    marginBottom: 0,
  },
});

function RoundView({
  image,
  peopleChoices,
  onPersonSelected,
}: RoundViewParams) {
  return (
    <>
      <View style={styles.main}>
        <Image source={{ uri: image }} width={300} height={500} />
        <View style={styles.choices}>
          {peopleChoices.map(person => (
            <c.Button
              key={`${person}${Math.random()}`}
              onclick={() => onPersonSelected(person)}
              outerStyle={styles.choiceButtonOuter}>
              {person}
            </c.Button>
          ))}
        </View>
      </View>
    </>
  );
}

export default RoundView;
