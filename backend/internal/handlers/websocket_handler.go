package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WebSocketHandler struct {
	hub *Hub
}

type Hub struct {
	clients    map[*Client]bool
	rooms      map[string]map[*Client]bool
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

type Client struct {
	id     uuid.UUID
	userID uuid.UUID
	conn   *websocket.Conn
	send   chan []byte
	hub    *Hub
	rooms  map[string]bool
	mutex  sync.Mutex
}

type Message struct {
	Type      string                 `json:"type"`
	Room      string                 `json:"room,omitempty"`
	From      uuid.UUID              `json:"from,omitempty"`
	To        *uuid.UUID             `json:"to,omitempty"`
	Payload   map[string]interface{} `json:"payload,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

type CursorUpdate struct {
	UserID   uuid.UUID `json:"userId"`
	UserName string    `json:"userName"`
	X        float64   `json:"x"`
	Y        float64   `json:"y"`
	Color    string    `json:"color"`
}

type SelectionUpdate struct {
	UserID    uuid.UUID `json:"userId"`
	UserName  string    `json:"userName"`
	ElementID string    `json:"elementId"`
	Action    string    `json:"action"`
}

type ElementUpdate struct {
	UserID    uuid.UUID              `json:"userId"`
	ElementID string                 `json:"elementId"`
	Changes   map[string]interface{} `json:"changes"`
	Action    string                 `json:"action"`
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan *Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)

				for room := range client.rooms {
					if roomClients, ok := h.rooms[room]; ok {
						delete(roomClients, client)
						if len(roomClients) == 0 {
							delete(h.rooms, room)
						}
					}
				}
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			if message.Room != "" {
				if roomClients, ok := h.rooms[message.Room]; ok {
					data, _ := json.Marshal(message)
					for client := range roomClients {
						if client.userID != message.From {
							select {
							case client.send <- data:
							default:
								close(client.send)
								delete(h.clients, client)
							}
						}
					}
				}
			} else if message.To != nil {
				data, _ := json.Marshal(message)
				for client := range h.clients {
					if client.userID == *message.To {
						select {
						case client.send <- data:
						default:
							close(client.send)
							delete(h.clients, client)
						}
						break
					}
				}
			} else {
				data, _ := json.Marshal(message)
				for client := range h.clients {
					if client.userID != message.From {
						select {
						case client.send <- data:
						default:
							close(client.send)
							delete(h.clients, client)
						}
					}
				}
			}
			h.mutex.RUnlock()
		}
	}
}

func (h *Hub) JoinRoom(client *Client, room string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, ok := h.rooms[room]; !ok {
		h.rooms[room] = make(map[*Client]bool)
	}
	h.rooms[room][client] = true
	client.rooms[room] = true

	message := &Message{
		Type:      "user_joined",
		Room:      room,
		From:      client.userID,
		Timestamp: time.Now(),
		Payload: map[string]interface{}{
			"userId": client.userID,
		},
	}
	h.broadcastToRoom(room, message, client.userID)
}

func (h *Hub) LeaveRoom(client *Client, room string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if roomClients, ok := h.rooms[room]; ok {
		delete(roomClients, client)
		delete(client.rooms, room)

		if len(roomClients) == 0 {
			delete(h.rooms, room)
		}

		message := &Message{
			Type:      "user_left",
			Room:      room,
			From:      client.userID,
			Timestamp: time.Now(),
			Payload: map[string]interface{}{
				"userId": client.userID,
			},
		}
		h.broadcastToRoomUnlocked(room, message, client.userID)
	}
}

func (h *Hub) broadcastToRoom(room string, message *Message, excludeUserID uuid.UUID) {
	if roomClients, ok := h.rooms[room]; ok {
		data, _ := json.Marshal(message)
		for client := range roomClients {
			if client.userID != excludeUserID {
				select {
				case client.send <- data:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

func (h *Hub) broadcastToRoomUnlocked(room string, message *Message, excludeUserID uuid.UUID) {
	if roomClients, ok := h.rooms[room]; ok {
		data, _ := json.Marshal(message)
		for client := range roomClients {
			if client.userID != excludeUserID {
				select {
				case client.send <- data:
				default:
				}
			}
		}
	}
}

func (h *Hub) GetRoomUsers(room string) []uuid.UUID {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	var users []uuid.UUID
	if roomClients, ok := h.rooms[room]; ok {
		for client := range roomClients {
			users = append(users, client.userID)
		}
	}
	return users
}

func NewWebSocketHandler() *WebSocketHandler {
	hub := NewHub()
	go hub.Run()
	return &WebSocketHandler{hub: hub}
}

func (h *WebSocketHandler) HandleConnection(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "User not authenticated",
		})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &Client{
		id:     uuid.New(),
		userID: userID.(uuid.UUID),
		conn:   conn,
		send:   make(chan []byte, 256),
		hub:    h.hub,
		rooms:  make(map[string]bool),
	}

	h.hub.register <- client

	go client.writePump()
	go client.readPump()

	welcomeMsg := &Message{
		Type:      "connected",
		From:      uuid.Nil,
		Timestamp: time.Now(),
		Payload: map[string]interface{}{
			"clientId": client.id,
			"userId":   client.userID,
		},
	}
	data, _ := json.Marshal(welcomeMsg)
	client.send <- data
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(65536)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		msg.From = c.userID
		msg.Timestamp = time.Now()

		c.handleMessage(&msg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg *Message) {
	switch msg.Type {
	case "join_room":
		if room, ok := msg.Payload["room"].(string); ok {
			c.hub.JoinRoom(c, room)
		}

	case "leave_room":
		if room, ok := msg.Payload["room"].(string); ok {
			c.hub.LeaveRoom(c, room)
		}

	case "cursor_move":
		c.hub.broadcast <- msg

	case "selection_change":
		c.hub.broadcast <- msg

	case "element_update":
		c.hub.broadcast <- msg

	case "element_create":
		c.hub.broadcast <- msg

	case "element_delete":
		c.hub.broadcast <- msg

	case "chat_message":
		c.hub.broadcast <- msg

	case "typing_start":
		c.hub.broadcast <- msg

	case "typing_stop":
		c.hub.broadcast <- msg

	case "request_sync":
		c.hub.broadcast <- msg

	case "sync_response":
		c.hub.broadcast <- msg

	case "ping":
		response := &Message{
			Type:      "pong",
			From:      uuid.Nil,
			Timestamp: time.Now(),
		}
		data, _ := json.Marshal(response)
		c.send <- data

	case "get_room_users":
		if room, ok := msg.Payload["room"].(string); ok {
			users := c.hub.GetRoomUsers(room)
			response := &Message{
				Type:      "room_users",
				Room:      room,
				Timestamp: time.Now(),
				Payload: map[string]interface{}{
					"users": users,
				},
			}
			data, _ := json.Marshal(response)
			c.send <- data
		}
	}
}

func (h *WebSocketHandler) BroadcastToRoom(room string, message *Message) {
	h.hub.mutex.RLock()
	defer h.hub.mutex.RUnlock()

	if roomClients, ok := h.hub.rooms[room]; ok {
		data, _ := json.Marshal(message)
		for client := range roomClients {
			select {
			case client.send <- data:
			default:
			}
		}
	}
}

func (h *WebSocketHandler) SendToUser(userID uuid.UUID, message *Message) {
	h.hub.mutex.RLock()
	defer h.hub.mutex.RUnlock()

	for client := range h.hub.clients {
		if client.userID == userID {
			data, _ := json.Marshal(message)
			select {
			case client.send <- data:
			default:
			}
			break
		}
	}
}

func (h *WebSocketHandler) GetConnectedUsers() []uuid.UUID {
	h.hub.mutex.RLock()
	defer h.hub.mutex.RUnlock()

	userSet := make(map[uuid.UUID]bool)
	for client := range h.hub.clients {
		userSet[client.userID] = true
	}

	var users []uuid.UUID
	for userID := range userSet {
		users = append(users, userID)
	}
	return users
}

func (h *WebSocketHandler) GetRoomUsers(room string) []uuid.UUID {
	return h.hub.GetRoomUsers(room)
}

func (h *WebSocketHandler) IsUserOnline(userID uuid.UUID) bool {
	h.hub.mutex.RLock()
	defer h.hub.mutex.RUnlock()

	for client := range h.hub.clients {
		if client.userID == userID {
			return true
		}
	}
	return false
}
