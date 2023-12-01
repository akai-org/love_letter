import { useEffect, useState } from "react";
import { FromRoomMessage, PlayerAction, PlayerActionPayload, RoomEvent, RoomEventListener as RoomEventListener, RoomEventsListeners, SocketStatus, roomEvents } from "../../types/Room";
import { GameState } from '../../types/Game';


const initialEventsListeners = roomEvents.reduce((acc, event) => {
  acc[event] = [];
  return acc;
}, {} as RoomEventsListeners);

/**
 * Custom hook to manage the connection to the room.
 * 
 * @param gameID ID of the game
 * @param clientID ID of the client
 * @param setState React hook to set the state
 * @returns Object containing the server status, the on and send functions
 * 
 * @example
 * const { status, on, send } = useRoom(gameID, clientID, setState);
 */
export default function useRoom(gameID: string, clientID: string, setState: React.Dispatch<React.SetStateAction<GameState>>) {

  const [socket,] = useState(() => new WebSocket(`ws://localhost:8000/ws/${gameID}/${clientID}`));
  const [status, setStatus] = useState<SocketStatus>("disconnected");

  const [eventsListeners, setEventsListeners] = useState<RoomEventsListeners>(initialEventsListeners);

  useEffect(() => {
    socket.onopen = () => setStatus("connected");
    socket.onclose = () => setStatus("disconnected");
    socket.onmessage = handleMessages;

    // setSocket(socket);
    return () => socket.close();
  }, [gameID, socket]);


  function handleMessages(ev: MessageEvent<FromRoomMessage>) {
    const { event, state } = ev.data;

    if ([event, state].every(v => v == undefined)) throw new Error('Message is empty.');

    // Call the event callback if the event is valid
    // then set the state if the state is valid
    if ([
      messageCallEvent(event!, eventsListeners),
      messageSetState(state!, setState)
    ].every(v => v == false)) throw new Error('Message is invalid.');
  }


  function on<U extends RoomEvent>(event: U, callback: RoomEventListener<U>) {
    setEventsListeners((callbacks: RoomEventsListeners) => {

      callbacks[event] = [...(event in callbacks ? callbacks[event] : []), callback]
      return callbacks;
    });
  }


  function send<A extends PlayerAction>(type: A, payload: PlayerActionPayload<A>) {
    socket.send(JSON.stringify({ action: { type, payload } }));
  }

  return { status: status, on: on, send: send };
}





function messageCallEvent(event: FromRoomMessage['event'], eventsListeners: RoomEventsListeners) {
  if (!(event && 'type' in event)) return false;
  if (!(event.type in eventsListeners)) return false;

  if (!('payload' in event)) return false;
  if (!(event.type in roomEvents)) return false;
  if (!(event.payload instanceof Array)) return false;

  // call callbacks
  eventsListeners[event.type].forEach((callback) => callback(event.payload as never));
}

function messageSetState(state: GameState, setState: React.Dispatch<React.SetStateAction<GameState>>) {
  if (!state) return false;
  setState(state);
}