"""Contains the main classes for Who Took That Photo"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
import random
import time
from typing import Literal
from zlib import adler32

GAME_CONFIG = {
    "ROUNDS": 1,
    "ROUND LENGTH": 5,
    "ROUND END LENGTH": 5,
}


def createGameID(salt: str, cutoff: int = 5):
    """creates a game id"""
    fill = list("1234567890")
    random.shuffle(fill)
    return (
        str(int(hex(adler32((str(time.time()) + salt).encode()))[2:], 16))
        + "".join(fill)
    )[:cutoff]


@dataclass
class ActionStatus:
    ok: bool
    code: int = 0

    """codes
    0: success
    1xx: related to a game
        101: game already in progress
        102: game not started yet
        103: game already finished
        104: game with specified id does not exist
    2xx: told to a player:
        201: player has already submitted an answer
        202: player already in the game
        203: player is not in game
        204: action requires admin
    """


@dataclass
class GameState:
    currentRound: int = 0

    progress: Literal["uninit", "in progress", "already done"] = "uninit"
    roundProgress: Literal["uninit", "pending", "results"] = "uninit"

    lastTimeSnap: float = 0
    """timestamp snapshot of some past event. used for timings such 
    as time left in the round or round results."""

    # player submitting -> their answer
    currentRoundPlayerAnswers: dict[str, str] = field(default_factory=dict)
    """note: answer is name, not uid though the submitter is a uid"""

    # options for the players for the current round
    currentRoundPlayerOptions: list[str] = field(default_factory=list)

    currentRoundCorrectAnswer: str = ""
    """note: this is a uid"""

    currentRoundImage: str = ""
    """The current round's base64 data url image/"""

    scores: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class PlayerData:
    name: str
    uid: str


@dataclass
class GameCallables:
    """List of callbacks for the game. All of their first arguments
    are the game code."""

    showRoundResults: Callable[[str, dict[str, int]], None]
    """Called when the round is over. Takes
    the current game state results as an
    argument."""

    gameEnded: Callable[[str, dict[str, int]], None]
    """Called when the game is over. Takes
    the game scores as an argument."""

    requestImage: Callable[[str, str], str]
    """Called to request an image from a user. Takes the
    player's uid and should return a base64 data url."""

    sendRoundData: Callable[[str, str, list[str]], None]
    """Called to give all the players an image and the
    options. Takes the base64 data image and the
    player options as its arguments."""

    setRound: Callable[[str, int], None]
    """Called to set the current round on the clients."""

    fwdTimeLeft: Callable[[str, int], None]
    """Called to tell the clients how much 
    time is left in the current round. The 
    argument is the time left in seconds."""


class Game:
    """Main game class. Contains useful functions
    to control game logic."""

    # the Game's id. Players
    # join the game with it
    gameId: str
    # list of players
    players: list[PlayerData]
    # uid
    creator: str

    # game state
    state = GameState()
    # callbacks
    callbacks: GameCallables

    deleteGame: Callable[[str], None]

    def __init__(
        self,
        gameId: str,
        creator: PlayerData,
        callbacks: GameCallables,
        deleteGame: Callable[[str], None],
    ) -> None:
        """Creates a Game.

        :param gameId: The game id.
        :param creator: The game creator's data.
        :param callbacks: Callbacks to run.
        :param deleteGame: Called to remove it when the game is finished.
        """

        self.gameId = gameId
        self.creator = creator.uid
        self.players = []
        self.player_join(creator)
        self.callbacks = callbacks

    def start_game(self):
        """Starts the game. New players will be
        rejected once this happens."""
        if self.state.progress == "in progress":
            return print(ActionStatus(False, 101))

        if self.state.progress == "already done":
            return print(ActionStatus(False, 103))

        self.state.progress = "in progress"

        self.callbacks.setRound(self.gameId, 0)

        t = True
        while t:
            t = self._tick()
            # prevent high cpu
            time.sleep(0.5)

        self.deleteGame(self.gameId)

    def _tick(self) -> bool:
        """Called whenever a new event should happen.
        :returns bool: Whether the game is still in progress.
        """

        if self.state.currentRound > GAME_CONFIG["ROUNDS"]:
            self.state.roundProgress = "results"
            self.state.progress = "already done"

            self.callbacks.gameEnded(
                self.gameId, self.uid_scores_to_named_scores(self.state.scores)
            )

            return False

        if self.state.currentRound == 0:
            self.state.currentRound = 1
            self.callbacks.setRound(self.gameId, 1)
            self.state.roundProgress = "uninit"  # unnecessary

        if self.state.roundProgress == "uninit":
            if time.time() - self.state.lastTimeSnap < GAME_CONFIG["ROUND END LENGTH"]:
                return True

            self.state.lastTimeSnap = time.time()
            self.state.currentRoundPlayerAnswers = {}
            self.state.roundProgress = "pending"
            self.state.currentRoundCorrectAnswer = random.choice(self.players).uid

            image = self.callbacks.requestImage(
                self.gameId, self.state.currentRoundCorrectAnswer
            )

            self.state.currentRoundImage = image

            if len(self.players) <= 4:
                self.state.currentRoundPlayerOptions = [x.name for x in self.players]
            else:
                # select 4 random
                self.state.currentRoundPlayerOptions = [
                    x.name for x in random.sample(self.players, 4)
                ]

            self.callbacks.sendRoundData(
                self.gameId,
                self.state.currentRoundImage,
                self.state.currentRoundPlayerOptions,
            )

            return True

        if self.state.roundProgress == "pending":
            timeCompleted = time.time() - self.state.lastTimeSnap

            if timeCompleted > GAME_CONFIG["ROUND LENGTH"]:
                self.state.roundProgress = "results"

            self.callbacks.fwdTimeLeft(
                self.gameId, GAME_CONFIG["ROUND LENGTH"] - round(timeCompleted)
            )

            return True

        if self.state.roundProgress == "results":
            results = self._get_round_results()
            for person, score in results.items():
                current = self.state.scores.setdefault(person, 0)
                self.state.scores[person] = score + current

            user_scores = self.uid_scores_to_named_scores(self.state.scores)

            self.callbacks.showRoundResults(
                self.gameId,
                user_scores,
            )

            # reset
            self.state.currentRound += 1
            self.state.roundProgress = "uninit"
            self.callbacks.setRound(self.gameId, self.state.currentRound)

            self.state.lastTimeSnap = time.time()

            return True

        return True

    def _get_round_results(self) -> dict[str, int]:
        answers: dict[str, int] = {}
        for submitter, answer in self.state.currentRoundPlayerAnswers.items():
            answerUid = self.get_uid_by_name(answer)
            isCorrect = answerUid == self.state.currentRoundCorrectAnswer

            answers[submitter] = 1 if isCorrect else 0

        return answers

    def player_answer_submit(self, uid: str, answer: str):
        """Should get called when a player
        submits their answer."""
        if uid in self.state.currentRoundPlayerAnswers:
            return ActionStatus(False, 201)

        self.state.currentRoundPlayerAnswers[uid] = answer

        return ActionStatus(True)

    def uid_scores_to_named_scores(self, scores: dict[str, int]):
        """Turns the internal scores (`dict[uid -> score]`) into user-friendly
        ones (`dict[name -> score]`)"""
        userified: dict[str, int] = {}

        for uid, score in scores.items():
            name = self.get_name_by_uid(uid)
            if name is None:
                continue

            userified[name] = score

        return userified

    def get_uid_by_name(self, name: str):
        """Gets a player's uid by their name"""

        matches = [p for p in self.players if p.name == name]

        return matches[0].uid if len(matches) >= 1 else None

    def get_name_by_uid(self, uid: str):
        """Gets a player's name by their uid"""

        matches = [p for p in self.players if p.uid == uid]

        return matches[0].name if len(matches) >= 1 else None

    def player_exit(self, uid: str):
        """Should get called when a player leaves."""
        # remove player
        self.players = [p for p in self.players if p.uid != uid]

        # if the game hasn't started, they
        # won't be in scores
        if self.state.progress == "uninit":
            return

        if uid in self.state.currentRoundPlayerAnswers:
            del self.state.currentRoundPlayerAnswers[uid]

        if uid in self.state.scores:
            del self.state.scores[uid]

    def player_name_exists(self, name: str):
        """Checks if a player exists by name."""
        if name in [p.name for p in self.players]:
            return True

        return False

    def player_uid_exists(self, uid: str):
        """Checks if a player exists by uid."""
        if uid in [p.uid for p in self.players]:
            return True

        return False

    def player_join(self, data: PlayerData) -> ActionStatus:
        """Should get called when a player joins."""
        if self.state.progress == "in progress":
            return ActionStatus(False, 101)

        if self.state.progress == "already done":
            return ActionStatus(False, 103)

        # checking player already exists happens
        # in `add_player` in the GameManager.

        self.players.append(data)

        return ActionStatus(True)


class GamesManager:
    """Wrapper around a list of `Game`s."""

    games: list[Game]
    funcs: GameCallables

    def __init__(self) -> None:
        self.games = []

    def set_funcs(self, funcs: GameCallables):
        self.funcs = funcs

    def create_game(self, creatorName: str, sid: str):
        """Creates a new Game.
        :returns: the game id."""
        salt = str(len(self.games))
        game = Game(
            createGameID(salt),
            PlayerData(creatorName, sid),
            self.funcs,
            self.remove_game
        )

        self.games.append(game)

        return game.gameId

    def remove_game(self, gameId: str):
        """Removes a game. This should be called when the game finishes
        or the game creator disconnects."""

        self.games = [g for g in self.games if g.gameId != gameId]

    def add_player(self, playerName: str, playerSid: str, gid: str):
        """Adds a player to a Game. `playerSid` should be provided
        by the Socket.IO server."""
        game = self.get_game(gid)
        if game is None:
            return ActionStatus(False, 104)

        if game.player_name_exists(playerName):
            return ActionStatus(False, 202)

        toAdd = PlayerData(playerName, playerSid)

        game = self.get_game(gid)
        if game is None:
            return ActionStatus(False, 104)

        game.player_join(toAdd)

        return ActionStatus(True)

    def get_game(self, gid: str):
        """Gets a `Game` by its id."""
        matches = [g for g in self.games if g.gameId == gid]
        return matches[0] if len(matches) >= 1 else None
