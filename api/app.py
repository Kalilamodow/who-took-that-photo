import time
from typing import TypedDict

import flask_socketio as sio
from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS

from wttp import ActionStatus, GamesManager, GameCallables, GAME_CONFIG

app = Flask(__name__, static_url_path="/assets", static_folder="./app/dist/assets")
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)
manager = GamesManager()


# RIP type safety
def getSioSid() -> str:
    sid: str | None = request.sid  # type: ignore
    if sid is None:
        raise LookupError("sio sid is none")

    return sid  # type: ignore


class JoinRequest(TypedDict):
    name: str
    gameId: str


@socketio.on("c:ask:config")
def wsc_ask_config():
    c = {
        "rounds": GAME_CONFIG["round_amt"],
        "roundLength": GAME_CONFIG["round_len"],
    }

    return c


@socketio.on("c:ask:menu/create")
def wsc_ask_create(playerName: str):
    sid = getSioSid()

    gameId = manager.create_game(playerName, sid)
    sio.join_room(gameId, sid)

    print("game", gameId, "created by", sid)

    return gameId


@socketio.on("c:ask:menu/join")
def wsc_ask_join(json: JoinRequest):
    sid = getSioSid()

    status = manager.add_player(json["name"], sid, json["gameId"])

    if not status.ok:
        print("error in ws_request_join:", status)

        return status.code

    print(sid, "joined", json["gameId"])
    sio.join_room(json["gameId"], sid)
    sio.emit(
        "s:say:lobby:player-joined", json["name"], to=json["gameId"], include_self=False
    )

    return 0


@socketio.on("c:ask:lobby/get-players-in-game")
def wsc_ask_get_players_in_game(gameId: str):
    game = manager.get_game(gameId)
    if game is None:
        status = ActionStatus(False, 104)

        return status.code

    _ = game.players  # force evaluation otherwise it's empty
    players = [p.name for p in game.players]
    print(players)
    return players


@socketio.on("c:say:lobby/start-game")
def wsc_say_start_game(gameId: str):
    # verify admin
    sid = getSioSid()
    game = manager.get_game(gameId)
    if game is None:
        return print(ActionStatus(False, 104))

    if game.creator != sid:
        return print(ActionStatus(False, 204))

    print("game", gameId, "started.")
    socketio.emit("s:say:lobby/game-started", to=gameId)

    time.sleep(3)  # intermediate screen
    game.start_game()


@socketio.on("disconnect")
def remove_player_from_games():
    sid = getSioSid()

    for room in sio.rooms(sid):
        sio.leave_room(room, sid)

    for game in manager.games:
        if game.player_uid_exists(sid):
            if game.creator == sid:
                # remove game
                sio.emit("s:say:lobby:lobby-del", to=game.gameId, include_self=False)
                manager.remove_game(game.gameId)
                print("removed game", game.gameId, "because owner disconnected")

                continue

            sio.emit(
                "s:say:lobby:player-left",
                game.get_name_by_uid(sid) or "unknown",
                to=game.gameId,
                include_self=False,
            )

            game.player_exit(sid)
            print(sid, "left game", game.gameId)

    print("disconnected", sid)


@socketio.on("c:say:game/choose-answer")
def wsc_say_choose_answer(gameId: str, answer: str):
    game = manager.get_game(gameId)
    if game is None:
        return

    sid = getSioSid()

    game.player_answer_submit(sid, answer)


def send_showRoundResults(gameCode: str, scores: dict[str, int]):
    socketio.emit("s:say:game/round-over", scores, to=gameCode)


def send_gameEnded(gameCode: str, scores: dict[str, int]):
    socketio.emit("s:say:game/game-ended", scores, to=gameCode)


def get_image_from_client(_: str, sid: str):
    image: str = socketio.call("s:ask:game/request-image", to=sid)
    return image


def send_round_info(gameCode: str, image: str, playerOptions: list[str]):
    socketio.emit(
        "s:say:game/round-start",
        {"image": image, "options": playerOptions},
        to=gameCode,
    )


def send_round(gameCode: str, roundNum: int):
    socketio.emit("s:say:game/sync-round", roundNum, to=gameCode)


def send_timeLeftInRound(gameCode: str, timeLeft: int):
    socketio.emit("s:say:game/time-left-in-round", timeLeft, to=gameCode)


if __name__ == "__main__":
    manager.set_funcs(
        GameCallables(
            send_showRoundResults,
            send_gameEnded,
            get_image_from_client,
            send_round_info,
            send_round,
            send_timeLeftInRound,
        )
    )

    socketio.run(app, "0.0.0.0", 5000, use_reloader=False, log_output=False)
