/**
 * Chip-8 Emulator in JavaScript (using p5.js)
 * Written by: PwnFunction
 * https://en.wikipedia.org/wiki/CHIP-8
 *
 * References:
 * http://devernay.free.fr/hacks/chip8/C8TECH10.HTM
 * https://tobiasvl.github.io/blog/write-a-chip-8-emulator/
 */

class Chip8 {
  constructor() {
    /**
     * The Chip-8 language is capable of accessing up to 4KB (4,096 bytes) of RAM,
     * from location 0x000 (0) to 0xFFF (4095). The first 512 bytes, from 0x000 to
     * 0x1FF, are where the original interpreter was located, and should not be
     * used by programs.
     *
     * Most Chip-8 programs start at location 0x200 (512), but some begin at
     * 0x600 (1536). Programs beginning at 0x600 are intended for
     * the ETI 660 computer.
     *
     * Memory Map:
     * +---------------+= 0xFFF (4095) End of Chip-8 RAM
     * |               |
     * |               |
     * |               |
     * |               |
     * |               |
     * | 0x200 to 0xFFF|
     * |     Chip-8    |
     * | Program / Data|
     * |     Space     |
     * |               |
     * |               |
     * |               |
     * +- - - - - - - -+= 0x600 (1536) Start of ETI 660 Chip-8 programs
     * |               |
     * |               |
     * |               |
     * +---------------+= 0x200 (512) Start of most Chip-8 programs
     * | 0x000 to 0x1FF|
     * | Reserved for  |
     * |  interpreter  |
     * +---------------+= 0x000 (0) Start of Chip-8 RAM
     */
    this.memory = new Uint8Array(4096); /* 4K */

    /**
     * Chip-8 has 16 general purpose 8-bit registers, usually referred to as Vx,
     * where x is a hexadecimal digit (0 through F). There is also a 16-bit register
     * called I. This register is generally used to store memory addresses, so only
     * the lowest (rightmost) 12 bits are usually used.
     *
     * The VF register should not be used by any program, as it is used as a flag by
     * some instructions.
     *
     * Chip-8 also has two special purpose 8-bit registers, for the delay and sound
     * timers. When these registers are non-zero, they are automatically decremented
     * at a rate of 60Hz.
     *
     * There are also some "pseudo-registers" which are not accessable from Chip-8
     * programs. The program counter (PC) should be 16-bit, and is used to store the
     * currently executing address. The stack pointer (SP) can be 8-bit, it is used
     * to point to the topmost level of the stack.
     *
     * The stack is an array of 16 16-bit values, used to store the address that the
     * interpreter should return to when finished with a subroutine. Chip-8 allows for
     * up to 16 levels of nested subroutines.
     */
    this.V = new Uint8Array(16); /* 16, 8-bit registers (V0 - VF) */
    this.I = 0x0; /* 16-bit address pointer */
    this.PC = 0x200; /* 16-bit program counter */
    this.SP = 0x0; /* 8-bit stack pointer */
    this.specialRegisters = new Uint8Array(
      2
    ); /* 2, 8-bit registers (delay(0) and sound timers(1)) */
    this.stack = new Uint16Array(16); /* 16, 16-bit values */

    /**
     * The original implementation of the Chip-8 language used a 64x32-pixel
     * monochrome display with this format:
     *
     * +-------------------+
     * |(0,0)        (63,0)|
     * |                   |
     * |                   |
     * |(0,31)      (63,31)|
     * +-------------------+
     */
    this.frameWidth = 64;
    this.frameHeight = 32;
    this.frameBuffer = new Uint8Array(
      this.frameWidth * this.frameHeight
    ); /* 64x32-pixel monochrome display */

    // CONFIG
    this.pixelBlockSize = 0x13;
    this.pixelStoke = true; /* DEBUG */
    this.pixelJitter = false; /* DEBUG */

    /**
     * Chip-8 draws graphics on screen through the use of sprites. A sprite is a
     * group of bytes which are a binary representation of the desired picture.
     * Chip-8 sprites may be up to 15 bytes, for a possible sprite size of 8x15.
     *
     * Programs may also refer to a group of sprites representing the hexadecimal
     * digits 0 through F. These sprites are 5 bytes long, or 8x5 pixels. The data
     * should be stored in the interpreter area of Chip-8 memory (0x000 to 0x1FF).
     * Below is a listing of each character's bytes, in binary and hexadecimal:
     *
     * 0xF0, 0x90, 0x90, 0x90, 0xF0 // 0
     * 0x20, 0x60, 0x20, 0x20, 0x70 // 1
     * 0xF0, 0x10, 0xF0, 0x80, 0xF0 // 2
     * 0xF0, 0x10, 0xF0, 0x10, 0xF0 // 3
     * 0x90, 0x90, 0xF0, 0x10, 0x10 // 4
     * 0xF0, 0x80, 0xF0, 0x10, 0xF0 // 5
     * 0xF0, 0x80, 0xF0, 0x90, 0xF0 // 6
     * 0xF0, 0x10, 0x20, 0x40, 0x40 // 7
     * 0xF0, 0x90, 0xF0, 0x90, 0xF0 // 8
     * 0xF0, 0x90, 0xF0, 0x10, 0xF0 // 9
     * 0xF0, 0x90, 0xF0, 0x90, 0x90 // A
     * 0xE0, 0x90, 0xE0, 0x90, 0xE0 // B
     * 0xF0, 0x80, 0x80, 0x80, 0xF0 // C
     * 0xE0, 0x90, 0x90, 0x90, 0xE0 // D
     * 0xF0, 0x80, 0xF0, 0x80, 0xF0 // E
     * 0xF0, 0x80, 0xF0, 0x80, 0x80 // F
     *
     * These fonts can be written anywhere in the interpreter memory, we'll follow
     * a popular convention (0x50–0x9F).
     */
    // prettier-ignore
    this.memory.set(
      new Uint8Array([
        0xf0, 0x90, 0x90, 0x90, 0xf0, // 0
        0x20, 0x60, 0x20, 0x20, 0x70, // 1
        0xf0, 0x10, 0xf0, 0x80, 0xf0, // 2
        0xf0, 0x10, 0xf0, 0x10, 0xf0, // 3
        0x90, 0x90, 0xf0, 0x10, 0x10, // 4
        0xf0, 0x80, 0xf0, 0x10, 0xf0, // 5
        0xf0, 0x80, 0xf0, 0x90, 0xf0, // 6
        0xf0, 0x10, 0x20, 0x40, 0x40, // 7
        0xf0, 0x90, 0xf0, 0x90, 0xf0, // 8
        0xf0, 0x90, 0xf0, 0x10, 0xf0, // 9
        0xf0, 0x90, 0xf0, 0x90, 0x90, // A
        0xe0, 0x90, 0xe0, 0x90, 0xe0, // B
        0xf0, 0x80, 0x80, 0x80, 0xf0, // C
        0xe0, 0x90, 0x90, 0x90, 0xe0, // D
        0xf0, 0x80, 0xf0, 0x80, 0xf0, // E
        0xf0, 0x80, 0xf0, 0x80, 0x80, // F
      ]),
      0x50
    );

    // halt execution
    this.halt = false;
  }

  /**
   * Fetches one instruction using PC
   */
  fetch() {
    /**
     * All instructions are 2 bytes long and are stored most-significant-byte
     * first. In memory, the first byte of each instruction should be located
     * at an even addresses.
     */
    const opcodes = [];
    while (opcodes.length < 2) {
      opcodes.push(this.memory[this.PC++]);
    }

    return opcodes;
  }

  /**
   * Decodes one instruction
   * @param {Uint8Array} opcodes
   */
  decode(opcodes) {
    switch (true) {
      /**
       * 0nnn - SYS addr
       * Jump to a machine code routine at nnn.
       *
       * This instruction is only used on the old computers on which Chip-8 was
       * originally implemented. It is ignored by modern interpreters.
       */
      case opcodes[0] & (0xf0 === 0x0):
        return { mnemonic: "SYS", opcodes };

      /**
       * 00E0 - CLS
       * Clear the display.
       */
      case opcodes[0] === 0x0 && opcodes[1] === 0xe0:
        return { mnemonic: "CLS", opcodes };

      /**
       * 00EE - RET
       * Return from a subroutine.
       *
       * The interpreter sets the program counter to the address at the top of
       * the stack, then subtracts 1 from the stack pointer.
       */
      case opcodes[0] === 0x0 && opcodes[1] === 0xee:
        return { mnemonic: "RET", opcodes };

      /**
       * 1nnn - JP addr
       * Jump to location nnn.
       *
       * The interpreter sets the program counter to nnn.
       */
      case (opcodes[0] & 0xf0) === 0x10:
        return { mnemonic: "JP", opcodes };

      /**
       * 2nnn - CALL addr
       * Call subroutine at nnn.
       *
       * The interpreter increments the stack pointer, then puts the current PC on
       * the top of the stack. The PC is then set to nnn.
       */
      case (opcodes[0] & 0xf0) === 0x20:
        return { mnemonic: "CALL", opcodes };

      /**
       * 3xkk - SE Vx, byte
       * Skip next instruction if Vx = kk.
       *
       * The interpreter compares register Vx to kk, and if they are equal, increments
       * the program counter by 2.
       */
      case (opcodes[0] & 0xf0) === 0x30:
        return { mnemonic: "SE", opcodes };

      /**
       * 4xkk - SNE Vx, byte
       * Skip next instruction if Vx != kk.
       *
       * The interpreter compares register Vx to kk, and if they are not equal, increments
       * the program counter by 2.
       */
      case (opcodes[0] & 0xf0) === 0x40:
        return { mnemonic: "SNE", opcodes };

      /**
       * 5xy0 - SE Vx, Vy
       * Skip next instruction if Vx = Vy.
       *
       * The interpreter compares register Vx to register Vy, and if they are equal,
       * increments the program counter by 2.
       */
      case (opcodes[0] & 0xf0) === 0x50 && (opcodes[1] & 0x0f) === 0x0:
        return { mnemonic: "SE", opcodes };

      /**
       * 6xkk - LD Vx, byte
       * Set Vx = kk.
       *
       * The interpreter puts the value kk into register Vx.
       */
      case (opcodes[0] & 0xf0) === 0x60:
        return { mnemonic: "LD", opcodes };

      /**
       * Annn - LD I, addr
       * Set I = nnn.
       *
       * The value of register I is set to nnn.
       */
      case (opcodes[0] & 0xf0) === 0xa0:
        return { mnemonic: "LD", opcodes };

      /**
       * 7xkk - ADD Vx, byte
       * Set Vx = Vx + kk.
       *
       * Adds the value kk to the value of register Vx, then stores the result in Vx.
       */
      case (opcodes[0] & 0xf0) === 0x70:
        return { mnemonic: "ADD", opcodes };

      /**
       * Dxyn - DRW Vx, Vy, nibble
       * Display n-byte sprite starting at memory location I at (Vx, Vy),
       * set VF = collision.
       */
      case (opcodes[0] & 0xf0) === 0xd0:
        return { mnemonic: "DRW", opcodes };

      /**
       * Zero operations
       */
      case opcodes[0] === 0x0 && opcodes[1] === 0x0:
        return { mnemonic: "ZERO", opcodes };

      /**
       * Invalid opcode
       */
      default:
        return { mnemonic: "INVALID", opcodes };
    }
  }

  /**
   * Executes one instruction
   */
  execute() {
    // halt execution
    if (this.halt) {
      return;
    }

    // Fetch 2 bytes (2 half instructions)
    const opcodes = this.fetch();
    const { mnemonic } = this.decode(opcodes);

    // temp
    let addr = 0;

    switch (mnemonic) {
      /**
       * 0nnn - SYS addr
       * Jump to a machine code routine at nnn.
       *
       * This instruction is only used on the old computers on which Chip-8 was
       * originally implemented. It is ignored by modern interpreters.
       */
      case "SYS":
        break;

      /**
       * 00E0 - CLS
       * Clear the display.
       */
      case "CLS":
        this.clearFrameBuffer();
        break;

      /**
       * 00EE - RET
       * Return from a subroutine.
       *
       * The interpreter sets the program counter to the address at the top of
       * the stack, then subtracts 1 from the stack pointer.
       */
      case "RET":
        if (this.SP === 0) {
          throw new Error("cannot return, call stack is empty");
        }

        this.PC = this.stack[this.SP--];
        break;

      /**
       * 1nnn - JP addr
       * Jump to location nnn.
       *
       * The interpreter sets the program counter to nnn.
       */
      case "JP":
        addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];
        if (addr < 0x200) {
          throw new Error("illegal jump to reserved address");
        }

        this.PC = addr;
        break;

      /**
       * 2nnn - CALL addr
       * Call subroutine at nnn.
       *
       * The interpreter increments the stack pointer, then puts the current PC on
       * the top of the stack. The PC is then set to nnn.
       */
      case "CALL":
        addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];

        // out of bounds gaurd
        if (addr < 0x200) {
          throw new Error("illegal subroutine call to reserved address");
        }

        // stack overflow gaurd
        if (this.SP >= this.stack.length) {
          throw new Error("call stack exceeded");
        }

        this.stack[this.SP++] = this.PC;
        this.PC = addr;
        break;

      /**
       * 3xkk - SE Vx, byte
       * 5xy0 - SE Vx, Vy
       */
      case "SE":
        if ((opcodes[0] & 0xf0) === 0x30) {
          /**
           * 3xkk - SE Vx, byte
           * Skip next instruction if Vx = kk.
           *
           * The interpreter compares register Vx to kk, and if they are equal, increments
           * the program counter by 2.
           */
          if (this.V[opcodes[0] & 0x0f] === opcodes[1]) {
            this.PC += 2;
          }
        } else if ((opcodes[0] & 0xf0) === 0x50) {
          /**
           * 5xy0 - SE Vx, Vy
           * Skip next instruction if Vx = Vy.
           *
           * The interpreter compares register Vx to register Vy, and if they are equal,
           * increments the program counter by 2.
           */
          if (
            this.V[opcodes[0] & 0x0f] === this.V[(opcodes[1] & 0xf0) >> 0x4]
          ) {
            this.PC += 2;
          }
        }
        break;

      /**
       * 4xkk - SNE Vx, byte
       * Skip next instruction if Vx != kk.
       *
       * The interpreter compares register Vx to kk, and if they are not equal, increments
       * the program counter by 2.
       */
      case "SNE":
        if (this.V[opcodes[0] & 0x0f] !== opcodes[1]) {
          this.PC += 2;
        }
        break;

      /**
       * Load operations
       */
      case "LD":
        if ((opcodes[0] & 0xf0) === 0x60) {
          /**
           * 6xkk - LD Vx, byte
           * Set Vx = kk.
           *
           * The interpreter puts the value kk into register Vx.
           */
          // VF write gaurd
          if ((opcodes[0] & 0x0f) === 0xf) {
            throw new Error("(VF register is reserved, cannot perform write)");
          }

          this.V[opcodes[0] & 0x0f] = opcodes[1];
          break;
        } else if ((opcodes[0] & 0xf0) === 0xa0) {
          /**
           * Annn - LD I, addr
           * Set I = nnn.
           *
           * The value of register I is set to nnn.
           */
          addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];
          this.I = addr;
          break;
        }

      /**
       * 7xkk - ADD Vx, byte
       * Set Vx = Vx + kk.
       *
       * Adds the value kk to the value of register Vx, then stores the result in Vx.
       */
      case "ADD":
        // VF write gaurd
        if ((opcodes[0] & 0x0f) === 0xf) {
          throw new Error("(VF register is reserved, cannot perform write)");
        }

        this.V[opcodes[0] & 0x0f] += opcodes[1];
        break;

      /**
       * Dxyn - DRW Vx, Vy, nibble
       * Display n-byte sprite starting at memory location I at (Vx, Vy),
       * set VF = collision.
       *
       * The interpreter reads n bytes from memory, starting at the address
       * stored in I. These bytes are then displayed as sprites on screen at
       * coordinates (Vx, Vy). Sprites are XORed onto the existing screen. If
       * this causes any pixels to be erased, VF is set to 1, otherwise it is
       * set to 0. If the sprite is positioned so part of it is outside the
       * coordinates of the display, it wraps around to the opposite side of
       * the screen.
       */
      case "DRW":
        let Vx = this.V[opcodes[0] & 0x0f];
        let Vy = this.V[(opcodes[1] & 0xf0) >> 0x4];
        let n = opcodes[1] & 0x0f;

        for (let i = 0; i < n; i++) {
          for (let e = 7; e >= 0; e--) {
            let frameBufferOffset =
              Vy * this.frameWidth + Vx + (7 - e) + i * this.frameWidth;

            let prevPixel = this.frameBuffer[frameBufferOffset];
            let newPixel =
              (this.memory[this.I + i] & (2 ** e)) === 2 ** e ? 1 : 0;

            // destructive xor update
            this.frameBuffer[frameBufferOffset] ^= newPixel;

            if (prevPixel === 1 && newPixel === 1) {
              this.V[0xf] = 1; // collision flag
            }
          }
        }

        break;

      /**
       * Zero operations
       */
      case "ZERO":
        // halt execution
        this.halt = true;
        this.PC -= 2;
        break;

      /**
       * Invalid opcode
       */
      default:
        throw new Error("invalid opcode");
    }
  }

  /**
   * Render the linear frame buffer
   */
  renderFrame() {
    /**
     * 64 x 32 pixel display
     * +-------------------+
     * |(0,0)        (63,0)|
     * |                   |
     * |                   |
     * |(0,31)      (63,31)|
     * +-------------------+
     *
     * The origin is in the center of the canvas
     *
     * +-------------------+
     * |(-32,16)    (31,16)|
     * |                   |
     * |                   |
     * |(-32,-15)  (31,-15)|
     * +-------------------+
     */
    for (let px = 0; px < this.frameWidth; px++) {
      for (let py = 0; py < this.frameHeight; py++) {
        if (this.frameBuffer[py * this.frameWidth + px] === 0x1) {
          rect(
            (-this.pixelBlockSize * this.frameWidth) / 2 +
              px * this.pixelBlockSize,
            (-this.pixelBlockSize * this.frameHeight) / 2 +
              py * this.pixelBlockSize,
            this.pixelBlockSize,
            this.pixelBlockSize
          );
        }
      }
    }
  }

  /*
   * Clear the frame buffer
   */
  clearFrameBuffer() {
    this.frameBuffer.fill(0x0);
  }

  /*
   * Fill the frame buffer
   */
  fillFrameBuffer() {
    for (let p = 0; p < this.frameBuffer.length; p++) {
      this.frameBuffer[p] = 0x1;
    }
  }

  /*
   * Fill the frame buffer with random values
   */
  randomFrameBuffer() {
    for (let p = 0; p < this.frameBuffer.length; p++) {
      this.frameBuffer[p] = Math.round(Math.random());
    }
  }

  /**
   * Load rom into memory
   * @param {Uint8Array} byteArray - Raw ROM bytes
   */
  loadROM(byteArray) {
    let entrypoint = 0x200;

    // flush old rom data
    this.memory.set(new Uint8Array(4096 - entrypoint).fill(0x0), entrypoint);
    this.memory.set(byteArray, entrypoint);
  }
}

class Chip8Debugger {
  constructor(chip8Instance) {
    this.chip8 = chip8Instance;
    this.vmemDump = document.querySelector("#vmem-dump");
    this.heapDump = document.querySelector("#heap-dump");
    this.regDump = document.querySelector("#reg-dump");
    this.disassemblyDump = document.querySelector("#disass-dump");
    this.autoUpdate = true;

    this.cpuClock = 0;
    this.executionInterval = null;
    this.started = false;
  }

  updateVmemDump() {
    this.updateElement(this.vmemDump, this.formatVmem());
  }

  updateHeapDump() {
    this.updateElement(this.heapDump, this.formatHeap());
  }

  updateRegDump() {
    this.updateElement(this.regDump, this.formatRegisters());
  }

  updateDisassembly() {
    this.updateElement(this.disassemblyDump, this.formatDisassembly());
  }

  /**
   * Signal update when text changes
   * @param {Element} element
   * @param {string} text
   */
  updateElement(element, text) {
    element.classList.add("update-text");
    setTimeout(() => element.classList.remove("update-text"), 500);
    element.innerText = text;
  }

  /**
   * Format vmem (frame buffer)
   * format "offset: pixels[0-15] pixels[16-31]"
   * @returns {string} - Formatted vmem
   */
  formatVmem() {
    let dumpText = "";
    for (let v = 0; v < this.chip8.frameBuffer.length; v += 32) {
      dumpText += `  0x${("000" + v.toString(16)).slice(
        -4
      )}  ${this.chip8.frameBuffer
        .slice(v, v + 16)
        .join(" ")}  ${this.chip8.frameBuffer
        .slice(v + 16, v + 32)
        .join(" ")}\n`;
    }
    return dumpText;
  }

  /**
   * Format heap
   * format "addr: byte[0-7] byte[8-15] ascii"
   * @returns {string} - Formatted heap
   */
  formatHeap() {
    let dumpText = "";
    for (let h = 0; h < this.chip8.memory.length; h += 16) {
      let lHalf = Array.from(this.chip8.memory).slice(h, h + 8),
        rHalf = Array.from(this.chip8.memory).slice(h + 8, h + 16);

      dumpText += `  0x${("000" + h.toString(16)).slice(-4)}  ${lHalf
        .map((i) => ("00" + i.toString(16)).slice(-2))
        .join(" ")}  ${rHalf
        .map((i) => ("00" + i.toString(16)).slice(-2))
        .join(" ")}  ${lHalf
        .concat(rHalf)
        .map((i) => (i >= 0x20 && i <= 0x7e ? String.fromCharCode(i) : "."))
        .join("")}\n`;
    }
    return dumpText;
  }

  /**
   * Format registers
   * format "v0-vf, i, pc, sp, delay, sound, stack"
   * @returns {string} - Formatted registers
   */
  formatRegisters() {
    return `${Array.from(this.chip8.V)
      .map((v, i) => `  v${i.toString(16)} = 0x${v.toString(16)}`)
      .join("\n")}\n\n  I = 0x${this.chip8.I.toString(
      16
    )}\n\n  PC = 0x${this.chip8.PC.toString(
      16
    )}\n  SP = 0x${this.chip8.SP.toString(
      16
    )}\n\n  delay = 0x${this.chip8.specialRegisters[0].toString(
      16
    )}\n  sound = 0x${this.chip8.specialRegisters[1].toString(
      16
    )}\n\n  stack\n${Array.from(this.chip8.stack)
      .map((s, i) => `   0x${i.toString(16)}: 0x${s.toString(16)}\n`)
      .join("")}\n  state: ${
      this.chip8.halt ? "halt" : this.started ? "running" : "idle"
    }\n\n`;
  }

  /**
   * Disassemble rom
   * format "addr: opcode[0-7] opcode[8-15] mnemonic"
   * @returns {string} - Formatted disassembly
   */
  formatDisassembly() {
    let dumpText = "";
    for (let i = 0x200; i < 0xfff; i += 0x2) {
      const { mnemonic, opcodes } = chip8.decode([
        chip8.memory[i],
        chip8.memory[i + 1],
      ]);

      dumpText += ` ${chip8.PC === i ? ">" : " "} 0x${(
        "00" + i.toString(16)
      ).slice(-4)}: ${("0" + opcodes[0].toString(16)).slice(-2)} ${(
        "0" + opcodes[1].toString(16)
      ).slice(-2)}  `;

      switch (mnemonic) {
        /**
         * 0nnn - SYS nnn
         * 00E0 - CLS
         * 00EE - RET
         */
        case "SYS":
        case "CLS":
        case "RET":
          dumpText += `${mnemonic}\n`;
          break;

        /**
         * 1nnn - JP nnn
         */
        case "JP":
          dumpText += `${mnemonic} 0x${(
            ((opcodes[0] & 0x0f) << 8) +
            opcodes[1]
          ).toString(16)}\n`;
          break;

        /**
         * 2nnn - CALL nnn
         */
        case "CALL":
          dumpText += `${mnemonic} 0x${(
            ((opcodes[0] & 0x0f) << 8) +
            opcodes[1]
          ).toString(16)}\n`;
          break;

        /**
         * 3xkk - SE Vx, kk
         * 5xy0 - SE Vx, Vy
         */
        case "SE":
          if ((opcodes[0] & 0xf0) === 0x30) {
            dumpText += `${mnemonic} v${
              opcodes[0] & 0x0f
            }, 0x${opcodes[1].toString(16)}\n`;
          } else if ((opcodes[0] & 0xf0) === 0x50) {
            dumpText += `${mnemonic} v${opcodes[0] & 0x0f}, v${
              (opcodes[1] & 0xf0) >> 0x4
            }\n`;
          }
          break;

        /**
         * 4xkk - SNE Vx, kk
         */
        case "SNE":
          dumpText += `${mnemonic} v${
            opcodes[0] & 0x0f
          }, 0x${opcodes[1].toString(16)}\n`;
          break;

        /**
         * 6xkk - LD Vx, kk
         * Annn - LD I, nnn
         */
        case "LD":
          if ((opcodes[0] & 0xf0) === 0x60) {
            dumpText += `${mnemonic} v${
              opcodes[0] & 0x0f
            }, 0x${opcodes[1].toString(16)}\n`;
          } else if ((opcodes[0] & 0xf0) === 0xa0) {
            dumpText += `${mnemonic} I, 0x${(
              ((opcodes[0] & 0x0f) << 8) +
              opcodes[1]
            ).toString(16)}\n`;
          }
          break;

        /**
         * 7xkk - ADD Vx, kk
         */
        case "ADD":
          dumpText += `${mnemonic} v${
            opcodes[0] & 0x0f
          }, 0x${opcodes[1].toString(16)}\n`;
          break;

        /**
         * Dxyn - DRW Vx, Vy, n
         */
        case "DRW":
          dumpText += `${mnemonic} v${opcodes[0] & 0x0f}, v${
            (opcodes[1] & 0xf0) >> 0x4
          }, 0x${(opcodes[1] & 0x0f).toString(16)}\n`;
          break;

        /**
         * Zero operations, end of program
         */
        case "ZERO":
          return dumpText;

        default:
          dumpText += `${("0" + opcodes[0].toString(16)).slice(-2)} ${(
            "0" + opcodes[1].toString(16)
          ).slice(-2)} (U)\n`; // mark unmatched
          break;
      }
    }

    return dumpText;
  }

  /**
   * Step through one instruction
   * @returns {void}
   */
  stepInstruction() {
    if (!this.started) {
      this.started = true;
    }
    this.chip8.execute();
    this.update();
  }

  /**
   * Continue execution
   * @returns {void}
   */
  async continueExecution() {
    if (!this.started) {
      this.started = true;
    }

    this.executionInterval = await setInterval(() => {
      this.chip8.execute();
      if (this.chip8.PC >= 0xfff) {
        clearInterval(this.executionInterval);
      }
    }, this.cpuClock);
  }

  /**
   * Stop execution
   * @returns {void}
   */
  async stopExecution() {
    clearInterval(this.executionInterval);
  }

  /**
   * Toggle auto update
   * @returns {void}
   */
  toggleAutoUpdate() {
    this.autoUpdate = !this.autoUpdate;
  }

  /**
   * Update all debugger elements
   * @returns {void}
   */
  async update() {
    this.updateVmemDump();
    this.updateHeapDump();
    this.updateRegDump();
    this.updateDisassembly();
  }
}

// Create a new instance of Chip8 & Chip8Debugger
const chip8 = new Chip8();
const chip8Debugger = new Chip8Debugger(chip8);
let fpsText = document.querySelector(".display__stats__fps");

/*
 * p5 setup function
 */
function setup() {
  createCanvas(
    chip8.frameWidth * chip8.pixelBlockSize,
    chip8.frameHeight * chip8.pixelBlockSize,
    WEBGL,
    document.querySelector("#display")
  );

  background(0);

  setTimeout(() => chip8Debugger.update(), 100);
  // update every 10 seconds
  setInterval(() => {
    if (chip8Debugger.autoUpdate) {
      chip8Debugger.update();
    }
  }, 10 * 1000);
}

/*
 * p5 draw function
 */
async function draw() {
  if (frameCount % 10 !== 0) {
    fpsText.innerText = `${parseInt(frameRate(), 10)} FPS`;
  }

  background(0);
  !chip8.pixelStoke && noStroke();
  chip8.renderFrame();
}

/**
 * Test Roms
 */
async function test_ibm() {
  // fetch rom from /roms/ibm-logo.ch8
  let rom = await fetch("/roms/ibm-logo.ch8");
  rom = new Uint8Array(await rom.arrayBuffer());
  chip8.loadROM(rom);
  return rom;
}

async function test_program() {
  // 00E0 - CLS
  chip8.memory[0x200] = 0x00;
  chip8.memory[0x201] = 0xe0;

  // 1nnn - JMP addr
  // JMP 0x234 - big endian
  chip8.memory[0x202] = 0x12;
  chip8.memory[0x203] = 0x04;

  // 6xkk - LD Vx, byte
  // LD V0, 0xde
  chip8.memory[0x204] = 0x60;
  chip8.memory[0x205] = 0xde;

  // 7xkk - ADD Vx, byte
  // ADD V1, 0xad
  chip8.memory[0x206] = 0x71;
  chip8.memory[0x207] = 0xad;

  // Annn - LD I, addr
  // LD I, 0x211
  chip8.memory[0x208] = 0xa2;
  chip8.memory[0x209] = 0x11;

  // DRAW '0'
  // set V2 to 4
  chip8.memory[0x20a] = 0x62;
  chip8.memory[0x20b] = 0x04;
  // set V3 to 4
  chip8.memory[0x20c] = 0x63;
  chip8.memory[0x20d] = 0x04;
  // set I to 0x50
  chip8.memory[0x20e] = 0xa0;
  chip8.memory[0x20f] = 0x50;
  // Dxyn - DRW Vx, Vy, nibble
  // DRW V2, V3, 5
  chip8.memory[0x210] = 0xd2;
  chip8.memory[0x211] = 0x35;
}

async function test_draw() {
  let rom = [
    // CLS
    0x00, 0xe0,
    // LD V2, 0x04
    0x62, 0x04,
    // LD V3, 0x04
    0x63, 0x04,
    // LD I, 0x50
    0xa0, 0x50,
    // DRW V2, V3, 5
    0xd2, 0x35,
    // SNE V4, 0x04
    0x44, 0x00,
    // SE V2, V3
    0x52, 0x60,
    // JMP 0x202
    0x12, 0x0e,
  ];
  chip8.loadROM(rom);
  return rom;
}

async function test_jmp() {
  let rom = [
    0x00,
    0xe0, // 0x200 CLS

    0x12,
    0x0c, // 0x202 JMP 0x20c

    0x60,
    0x04, // 0x204 LD V0, 0x4

    0x61,
    0x04, // 0x206 LD V1, 0x4

    0xd0,
    0x15, // 0x208 DRW V0, V1, 5

    0x00,
    0xee, // 0x20a RET

    0x22,
    0x04, // 0x20c CALL 0x204
  ];
  chip8.loadROM(rom);
  return rom;
}

/*
 * Entrypoint
 */
async function main() {
  await test_draw();
}

main();
