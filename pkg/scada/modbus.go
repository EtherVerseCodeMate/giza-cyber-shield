// Package scada provides a minimal Modbus TCP client for reading ESP32 sensor registers.
// No external dependencies — pure net/io/encoding.
package scada

import (
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"time"
)

const (
	mbapHeaderLen  = 6 // Transaction ID (2) + Protocol ID (2) + Length (2)
	responsePrefix = 3 // Unit ID (1) + Function Code (1) + Byte Count (1)
	dialTimeout    = 3 * time.Second
	rwTimeout      = 3 * time.Second
)

// ReadHoldingRegisters reads `quantity` holding registers from a Modbus TCP device,
// starting at `startAddr` (0-based protocol address). Returns values in register order.
func ReadHoldingRegisters(host string, port int, unitID byte, startAddr, quantity uint16) ([]uint16, error) {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), dialTimeout)
	if err != nil {
		return nil, fmt.Errorf("dial %s:%d: %w", host, port, err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(rwTimeout)) //nolint:errcheck

	// MBAP header + PDU: 12 bytes total
	req := [12]byte{
		0x00, 0x01, // Transaction ID (arbitrary)
		0x00, 0x00, // Protocol ID (always 0 for Modbus TCP)
		0x00, 0x06, // Length: 6 bytes follow (Unit ID + FC + 4 data bytes)
		unitID, 0x03, // Unit ID, FC03 = Read Holding Registers
		byte(startAddr >> 8), byte(startAddr),
		byte(quantity >> 8), byte(quantity),
	}
	if _, err := conn.Write(req[:]); err != nil {
		return nil, fmt.Errorf("write request: %w", err)
	}

	// Response: MBAP (6) + Unit ID (1) + FC (1) + ByteCount (1) = 9 bytes, then data
	header := make([]byte, 9)
	if _, err := io.ReadFull(conn, header); err != nil {
		return nil, fmt.Errorf("read response header: %w", err)
	}

	// Error response: FC is ORed with 0x80
	if header[7]&0x80 != 0 {
		errCode := make([]byte, 1)
		io.ReadFull(conn, errCode) //nolint:errcheck
		return nil, fmt.Errorf("modbus exception code %d (FC 0x%02x)", errCode[0], header[7]&0x7f)
	}

	byteCount := int(header[8])
	if byteCount != int(quantity)*2 {
		return nil, fmt.Errorf("unexpected byte count: got %d, want %d", byteCount, quantity*2)
	}

	data := make([]byte, byteCount)
	if _, err := io.ReadFull(conn, data); err != nil {
		return nil, fmt.Errorf("read register data: %w", err)
	}

	regs := make([]uint16, quantity)
	for i := range regs {
		regs[i] = binary.BigEndian.Uint16(data[i*2:])
	}
	return regs, nil
}
