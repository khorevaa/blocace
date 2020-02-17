package p2p

import (
	"context"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/perlin-network/noise"
	"github.com/perlin-network/noise/kademlia"
	log "github.com/sirupsen/logrus"
	"github.com/thoas/go-funk"

	"github.com/codingpeasant/blocace/blockchain"
)

var DefaultPort = 6091

type P2P struct {
	Node    *noise.Node
	overlay *kademlia.Protocol
}

// BroadcastObject sends a serializable object to all the known peers
func (p *P2P) BroadcastObject(object noise.Serializable) {
	for _, id := range p.overlay.Table().Peers() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err := p.Node.SendMessage(ctx, id.Address, object)
		cancel()

		if err != nil {
			log.Errorf("failed to send object to %s(%s). Skipping... [error: %s]\n",
				id.Address,
				id.ID.String(),
				err,
			)
			continue
		}
	}
}

func NewP2P(bindHost string, bindPort uint16, advertiseAddress string, connectionAddresses ...string) *P2P {
	// Create a new configured node.
	node, err := noise.NewNode(
		noise.WithNodeBindHost(net.ParseIP(bindHost)),
		noise.WithNodeBindPort(bindPort),
		noise.WithNodeAddress(advertiseAddress),
	)

	if err != nil {
		log.Panic(err)
	}

	// Register the chatMessage Go type to the node with an associated unmarshal function.
	node.RegisterMessage(blockchain.Account{}, blockchain.UnmarshalAccount)

	// Register a message handler to the node.
	node.Handle(handleAccount)

	// Instantiate Kademlia.
	events := kademlia.Events{
		OnPeerAdmitted: func(id noise.ID) {
			log.Infof("Learned about a new peer %s(%s).\n", id.Address, id.ID.String())
		},
		OnPeerEvicted: func(id noise.ID) {
			log.Infof("Forgotten a peer %s(%s).\n", id.Address, id.ID.String())
		},
	}

	overlay := kademlia.New(kademlia.WithProtocolEvents(events))

	// Bind Kademlia to the node.
	node.Bind(overlay.Protocol())

	// Have the node start listening for new peers.
	err = node.Listen()
	if err != nil {
		log.Panic(err)
	}

	if !funk.IsEmpty(connectionAddresses) {
		// Ping nodes to initially bootstrap and discover peers from.
		bootstrap(node, connectionAddresses)
		// Attempt to discover peers if we are bootstrapped to any nodes.
		discover(overlay)
	} else {
		log.Info("no peer address(es) provided, starting without trying to discover")
	}

	return &P2P{Node: node, overlay: overlay}
}

// bootstrap pings and dials an array of network addresses which we may interact with and  discover peers from.
func bootstrap(node *noise.Node, addresses []string) {
	for _, addr := range addresses {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		_, err := node.Ping(ctx, addr)
		cancel()

		if err != nil {
			log.Warnf("failed to ping bootstrap node (%s). [%s]\n", addr, err)
			continue
		}
	}
}

// discover uses Kademlia to discover new peers from nodes we already are aware of.
func discover(overlay *kademlia.Protocol) {
	ids := overlay.Discover()

	var str []string
	for _, id := range ids {
		str = append(str, fmt.Sprintf("%s(%s)", id.Address, id.ID.String()))
	}

	if len(ids) > 0 {
		log.Infof("discovered %d peer(s): [%v]\n", len(ids), strings.Join(str, ", "))
	} else {
		log.Warn("did not discover any peers.")
	}
}

// handleAccount unmarshal the object from peers and persist it to local DB
func handleAccount(ctx noise.HandlerContext) error {
	if ctx.IsRequest() {
		return nil
	}

	obj, err := ctx.DecodeMessage()
	if err != nil {
		return err
	}

	msg, ok := obj.(blockchain.Account)
	if !ok {
		return &net.ParseError{}
	}

	fmt.Printf("%s(%s)> %+v\n", ctx.ID().Address, ctx.ID().ID.String(), msg)

	return nil
}
