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
     * Example: The hexadecimal digit "0" is represented by the following 5 bytes:
     *
     * "0"	  Binary	   Hex
     * ****   11110000   0xF0
     * *  *   10010000   0x90
     * *  *   10010000   0x90
     * *  *   10010000   0x90
     * ****   11110000   0xF0
     *
     * '0' is represented as [0xF0, 0x90, 0x90, 0x90, 0xF0], similarly for others
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

    /**
     * System states
     */
    this.halt = false;
    this.panicState = false;
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
       * 7xkk - ADD Vx, byte
       * Set Vx = Vx + kk.
       *
       * Adds the value kk to the value of register Vx, then stores the result in Vx.
       */
      case (opcodes[0] & 0xf0) === 0x70:
        return { mnemonic: "ADD", opcodes };

      /**
       * 8xy0 - LD Vx, Vy
       * Set Vx = Vy.
       *
       * Stores the value of register Vy in register Vx.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0x0:
        return { mnemonic: "LD", opcodes };

      /**
       * 8xy1 - OR Vx, Vy
       * Set Vx = Vx OR Vy.
       *
       * Performs a bitwise OR on the values of Vx and Vy, then stores the result in Vx.
       * A bitwise OR compares the corrseponding bits from two values, and if either bit
       * is 1, then the same bit in the result is also 1. Otherwise, it is 0.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0x1:
        return { mnemonic: "OR", opcodes };

      /**
       * 8xy2 - AND Vx, Vy
       * Set Vx = Vx AND Vy.
       *
       * Performs a bitwise AND on the values of Vx and Vy, then stores the result in Vx.
       * A bitwise AND compares the corrseponding bits from two values, and if both bits
       * are 1, then the same bit in the result is also 1. Otherwise, it is 0.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0x2:
        return { mnemonic: "AND", opcodes };

      /**
       * 8xy3 - XOR Vx, Vy
       * Set Vx = Vx XOR Vy.
       *
       * Performs a bitwise exclusive OR on the values of Vx and Vy, then stores the result
       * in Vx. An exclusive OR compares the corrseponding bits from two values, and if the
       * bits are not both the same, then the corresponding bit in the result is set to 1.
       * Otherwise, it is 0.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0x3:
        return { mnemonic: "XOR", opcodes };

      /**
       * 8xy4 - ADD Vx, Vy
       * Set Vx = Vx + Vy, set VF = carry.
       *
       * The values of Vx and Vy are added together. If the result is greater than 8 bits
       * (i.e., > 255,) VF is set to 1, otherwise 0. Only the lowest 8 bits of the result
       * are kept, and stored in Vx.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0x4:
        return { mnemonic: "ADD", opcodes };

      /**
       * 8xy5 - SUB Vx, Vy
       * Set Vx = Vx - Vy, set VF = NOT borrow.
       *
       * If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx, and
       * the results stored in Vx.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0x5:
        return { mnemonic: "SUB", opcodes };

      /**
       * 8xy6 - SHR Vx {, Vy}
       * Set Vx = Vx SHR 1.
       *
       * If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx
       * is divided by 2.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0x6:
        return { mnemonic: "SHR", opcodes };

      /**
       * 8xy7 - SUBN Vx, Vy
       * Set Vx = Vy - Vx, set VF = NOT borrow.
       *
       * If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy, and
       * the results stored in Vx.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0x7:
        return { mnemonic: "SUBN", opcodes };

      /**
       * 8xyE - SHL Vx {, Vy}
       * Set Vx = Vx SHL 1.
       *
       * If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0.
       * Then Vx is multiplied by 2.
       */
      case (opcodes[0] & 0xf0) === 0x80 && (opcodes[1] & 0x0f) === 0xe:
        return { mnemonic: "SHL", opcodes };

      /**
       * 9xy0 - SNE Vx, Vy
       * Skip next instruction if Vx != Vy.
       *
       * The values of Vx and Vy are compared, and if they are not equal, the program
       * counter is increased by 2.
       */
      case (opcodes[0] & 0xf0) === 0x90 && (opcodes[1] & 0x0f) === 0x0:
        return { mnemonic: "SNE", opcodes };

      /**
       * Annn - LD I, addr
       * Set I = nnn.
       *
       * The value of register I is set to nnn.
       */
      case (opcodes[0] & 0xf0) === 0xa0:
        return { mnemonic: "LD", opcodes };

      /**
       * Bnnn - JP V0, addr
       * Jump to location nnn + V0.
       *
       * The program counter is set to nnn plus the value of V0.
       */
      case (opcodes[0] & 0xf0) === 0xb0:
        return { mnemonic: "JP", opcodes };

      /**
       * Cxkk - RND Vx, byte
       * Set Vx = random byte AND kk.
       *
       * The interpreter generates a random number from 0 to 255, which is then ANDed
       * with the value kk. The results are stored in Vx. See instruction 8xy2 for more
       * information on AND.
       */
      case (opcodes[0] & 0xf0) === 0xc0:
        return { mnemonic: "RND", opcodes };

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
    if (this.halt || this.panicState) {
      return;
    }

    // Fetch 2 bytes (2 half instructions)
    const opcodes = this.fetch();
    const { mnemonic } = this.decode(opcodes);

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
          this.panic("cannot return, call stack is empty");
        }

        this.PC = this.stack[this.SP--];
        break;

      /**
       * Jump operations
       */
      case "JP":
        if ((opcodes[0] & 0xf0) === 0x10) {
          /**
           * 1nnn - JP addr
           * Jump to location nnn.
           *
           * The interpreter sets the program counter to nnn.
           */
          let addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];

          // reserved address gaurd
          if (addr < 0x200) {
            this.panic("illegal jump to reserved address");
          }

          // out of bounds gaurd
          if (addr >= this.memory.length) {
            this.panic("illegal jump to out of bounds address");
          }

          this.PC = addr;
        } else if ((opcodes[0] & 0xf0) === 0xb0) {
          /**
           * Bnnn - JP V0, addr
           * Jump to location nnn + V0.
           *
           * The program counter is set to nnn plus the value of V0.
           */
          let addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];

          // reserved address gaurd
          if (addr < 0x200) {
            this.panic("illegal jump to reserved address");
          }

          // out of bounds gaurd
          if (addr >= this.memory.length) {
            this.panic("illegal jump to out of bounds address");
          }

          this.PC = addr + this.V[0x0];
        }
        break;

      /**
       * 2nnn - CALL addr
       * Call subroutine at nnn.
       *
       * The interpreter increments the stack pointer, then puts the current PC on
       * the top of the stack. The PC is then set to nnn.
       */
      case "CALL":
        {
          let addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];

          // out of bounds gaurd
          if (addr < 0x200) {
            this.panic("illegal subroutine call to reserved address");
          }

          // stack overflow gaurd
          if (this.SP >= this.stack.length) {
            this.panic("call stack exceeded");
          }

          this.stack[this.SP++] = this.PC;
          this.PC = addr;
        }
        break;

      /**
       * Skip operations
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
       * Skip operations
       * 4xkk - SNE Vx, byte
       * 9xy0 - SNE Vx, Vy
       */
      case "SNE":
        if ((opcodes[0] & 0xf0) === 0x90 && (opcodes[1] & 0x0f) === 0x0) {
          /**
           * 9xy0 - SNE Vx, Vy
           * Skip next instruction if Vx != Vy.
           *
           * The values of Vx and Vy are compared, and if they are not equal, the program
           * counter is increased by 2.
           */
          if (
            this.V[opcodes[0] & 0x0f] !== this.V[(opcodes[1] & 0xf0) >> 0x4]
          ) {
            this.PC += 2;
          }
        } else if ((opcodes[0] & 0xf0) === 0x40) {
          /**
           * 4xkk - SNE Vx, byte
           * Skip next instruction if Vx != kk.
           *
           * The interpreter compares register Vx to kk, and if they are not equal, increments
           * the program counter by 2.
           */
          if (this.V[opcodes[0] & 0x0f] !== opcodes[1]) {
            this.PC += 2;
          }
        }
        break;

      /**
       * Load operations
       * 6xkk - LD Vx, byte
       * Annn - LD I, addr
       * 8xy0 - LD Vx, Vy
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
          this.checkVFWriteGaurd(opcodes[0]);
          this.V[opcodes[0] & 0x0f] = opcodes[1];
        } else if ((opcodes[0] & 0xf0) === 0xa0) {
          /**
           * Annn - LD I, addr
           * Set I = nnn.
           *
           * The value of register I is set to nnn.
           */
          let addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];
          this.I = addr;
        } else if (
          (opcodes[0] & 0xf0) === 0x80 &&
          (opcodes[1] & 0x0f) === 0x0
        ) {
          /**
           * 8xy0 - LD Vx, Vy
           * Set Vx = Vy.
           *
           * Stores the value of register Vy in register Vx.
           */
          // VF write gaurd
          this.checkVFWriteGaurd(opcodes[0]);
          this.V[opcodes[0] & 0x0f] = this.V[(opcodes[1] & 0xf0) >> 0x4];
        }

        break;

      /**
       * Add operations
       * 7xkk - ADD Vx, byte
       * 8xy4 - ADD Vx, Vy
       */
      case "ADD":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);

        if ((opcodes[0] & 0xf0) === 0x70) {
          /**
           * 7xkk - ADD Vx, byte
           * Set Vx = Vx + kk.
           *
           * Adds the value kk to the value of register Vx, then stores the result in Vx.
           */
          this.V[opcodes[0] & 0x0f] += opcodes[1];
        } else if (
          (opcodes[0] & 0xf0) === 0x80 &&
          (opcodes[1] & 0x0f) === 0x4
        ) {
          /**
           * 8xy4 - ADD Vx, Vy
           * Set Vx = Vx + Vy, set VF = carry.
           *
           * The values of Vx and Vy are added together. If the result is greater than 8 bits
           * (i.e., > 255,) VF is set to 1, otherwise 0. Only the lowest 8 bits of the result
           * are kept, and stored in Vx.
           */
          let sum =
            this.V[opcodes[0] & 0x0f] + this.V[(opcodes[1] & 0xf0) >> 0x4];
          this.V[opcodes[0] & 0x0f] = sum & 0xff;
          this.V[0xf] = sum > 0xff ? 1 : 0;
        }
        break;

      /**
       * 8xy1 - OR Vx, Vy
       * Set Vx = Vx OR Vy.
       *
       * Performs a bitwise OR on the values of Vx and Vy, then stores the result in Vx.
       * A bitwise OR compares the corrseponding bits from two values, and if either bit
       * is 1, then the same bit in the result is also 1. Otherwise, it is 0.
       */
      case "OR":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);

        this.V[opcodes[0] & 0x0f] |= this.V[(opcodes[1] & 0xf0) >> 0x4];
        break;

      /**
       * 8xy2 - AND Vx, Vy
       * Set Vx = Vx AND Vy.
       *
       * Performs a bitwise AND on the values of Vx and Vy, then stores the result in Vx.
       * A bitwise AND compares the corrseponding bits from two values, and if both bits
       * are 1, then the same bit in the result is also 1. Otherwise, it is 0.
       */
      case "AND":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);

        this.V[opcodes[0] & 0x0f] &= this.V[(opcodes[1] & 0xf0) >> 0x4];
        break;

      /**
       * 8xy3 - XOR Vx, Vy
       * Set Vx = Vx XOR Vy.
       *
       * Performs a bitwise exclusive OR on the values of Vx and Vy, then stores the result
       * in Vx. An exclusive OR compares the corrseponding bits from two values, and if the
       * bits are not both the same, then the corresponding bit in the result is set to 1.
       * Otherwise, it is 0.
       */
      case "XOR":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);

        this.V[opcodes[0] & 0x0f] ^= this.V[(opcodes[1] & 0xf0) >> 0x4];
        break;

      /**
       * 8xy5 - SUB Vx, Vy
       * Set Vx = Vx - Vy, set VF = NOT borrow.
       *
       * If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx, and
       * the results stored in Vx.
       */
      case "SUB":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);

        // not sure if in equal case VF should be set to 1
        this.V[0xf] =
          this.V[opcodes[0] & 0x0f] > this.V[(opcodes[1] & 0xf0) >> 0x4]
            ? 1
            : 0;
        this.V[opcodes[0] & 0x0f] -= this.V[(opcodes[1] & 0xf0) >> 0x4];
        break;

      /**
       * 8xy6 - SHR Vx {, Vy}
       * Set Vx = Vx SHR 1.
       *
       * If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx
       * is divided by 2.
       */
      case "SHR":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);

        /**
         * In the CHIP-8 interpreter for the original COSMAC VIP, this instruction did the
         * following: It put the value of VY into VX, and then shifted the value in VX 1 bit
         * to the right (8XY6) or left (8XYE). VY was not affected, but the flag register VF
         * would be set to the bit that was shifted out.
         *
         * However, starting with CHIP-48 and SUPER-CHIP in the early 1990s, these instructions
         * were changed so that they shifted VX in place, and ignored the Y completely.
         *
         * This is one of the main differences between implementations that cause problems for
         * programs.
         */

        this.V[0xf] = this.V[opcodes[0] & 0x0f] & 0x1;
        this.V[opcodes[0] & 0x0f] >>= 1;
        break;

      /**
       * 8xy7 - SUBN Vx, Vy
       * Set Vx = Vy - Vx, set VF = NOT borrow.
       *
       * If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy, and
       * the results stored in Vx.
       */
      case "SUBN":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);

        this.V[0xf] =
          this.V[(opcodes[1] & 0xf0) >> 0x4] > this.V[opcodes[0] & 0x0f]
            ? 1
            : 0;
        this.V[opcodes[0] & 0x0f] =
          this.V[(opcodes[1] & 0xf0) >> 0x4] - this.V[opcodes[0] & 0x0f];
        break;

      /**
       * 8xyE - SHL Vx {, Vy}
       * Set Vx = Vx SHL 1.
       *
       * If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0.
       * Then Vx is multiplied by 2.
       */
      case "SHL":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);

        /**
         * In the CHIP-8 interpreter for the original COSMAC VIP, this instruction did the
         * following: It put the value of VY into VX, and then shifted the value in VX 1 bit
         * to the right (8XY6) or left (8XYE). VY was not affected, but the flag register VF
         * would be set to the bit that was shifted out.
         *
         * However, starting with CHIP-48 and SUPER-CHIP in the early 1990s, these instructions
         * were changed so that they shifted VX in place, and ignored the Y completely.
         *
         * This is one of the main differences between implementations that cause problems for
         * programs.
         */

        this.V[0xf] = this.V[opcodes[0] & 0x0f] >> 7;
        this.V[opcodes[0] & 0x0f] <<= 1;
        break;

      /**
       * Cxkk - RND Vx, byte
       * Set Vx = random byte AND kk.
       *
       * The interpreter generates a random number from 0 to 255, which is then ANDed
       * with the value kk. The results are stored in Vx. See instruction 8xy2 for more
       * information on AND.
       */
      case "RND":
        // VF write gaurd
        this.checkVFWriteGaurd(opcodes[0]);
        this.V[opcodes[0] & 0x0f] =
          Math.floor(Math.random() * 0xff) & opcodes[1];
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
        this.panicState = true;

      /**
       * Invalid opcode
       */
      default:
        this.panic(
          `invalid opcode (0x${opcodes[0].toString(
            16
          )}, 0x${opcodes[1].toString(16)})`
        );
    }
  }

  /**
   * Check VF write gaurd
   */
  checkVFWriteGaurd(opcode) {
    if ((opcode & 0x0f) === 0xf) {
      this.panic("(VF register is reserved, cannot perform write)");
    }
  }

  /**
   * Panic
   */
  panic(message) {
    this.panicState = true;
    this.halt = true;
    this.PC -= 2;
    throw new Error(message);
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
    this.vmemMd5 = document.querySelector("#vmem-md5");
    this.heapDump = document.querySelector("#heap-dump");
    this.heapMd5 = document.querySelector("#heap-md5");
    this.regDump = document.querySelector("#reg-dump");
    this.disassemblyDump = document.querySelector("#disass-dump");
    this.autoUpdate = true;

    this.cpuClock = 0;
    this.executionInterval = null;
    this.started = false;
  }

  updateVmemDump() {
    this.updateElement(this.vmemDump, this.formatVmem());
    this.vmemMd5.innerText = CryptoJS.MD5(
      CryptoJS.lib.WordArray.create(this.chip8.frameBuffer)
    )
      .toString()
      .slice(0, 6);
  }

  updateHeapDump() {
    this.updateElement(this.heapDump, this.formatHeap());
    this.heapMd5.innerText = CryptoJS.MD5(
      CryptoJS.lib.WordArray.create(this.chip8.memory)
    )
      .toString()
      .slice(0, 6);
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
      this.chip8.panicState
        ? "panic"
        : this.chip8.halt
        ? "halt"
        : this.started
        ? "running"
        : "idle"
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
         * Bnnn - JP V0, nnn
         */
        case "JP":
          if ((opcodes[0] & 0xf0) === 0x10) {
            dumpText += `${mnemonic} 0x${(
              ((opcodes[0] & 0x0f) << 8) +
              opcodes[1]
            ).toString(16)}\n`;
          } else if ((opcodes[0] & 0xf0) === 0xb0) {
            dumpText += `${mnemonic} v0, 0x${(
              ((opcodes[0] & 0x0f) << 8) +
              opcodes[1]
            ).toString(16)}\n`;
          }
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
            dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(
              16
            )}, 0x${opcodes[1].toString(16)}\n`;
          } else if ((opcodes[0] & 0xf0) === 0x50) {
            dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
              (opcodes[1] & 0xf0) >>
              0x4
            ).toString(16)}\n`;
          }
          break;

        /**
         * 4xkk - SNE Vx, kk
         * 9xy0 - SNE Vx, Vy
         */
        case "SNE":
          if ((opcodes[0] & 0xf0) === 0x90 && (opcodes[1] & 0x0f) === 0x0) {
            dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
              (opcodes[1] & 0xf0) >>
              0x4
            ).toString(16)}\n`;
          } else if ((opcodes[0] & 0xf0) === 0x40) {
            dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(
              16
            )}, 0x${opcodes[1].toString(16)}\n`;
          }
          break;

        /**
         * 6xkk - LD Vx, kk
         * Annn - LD I, nnn
         * 8xy0 - LD Vx, Vy
         */
        case "LD":
          if ((opcodes[0] & 0xf0) === 0x60) {
            dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(
              16
            )}, 0x${opcodes[1].toString(16)}\n`;
          } else if ((opcodes[0] & 0xf0) === 0xa0) {
            dumpText += `${mnemonic} I, 0x${(
              ((opcodes[0] & 0x0f) << 8) +
              opcodes[1]
            ).toString(16)}\n`;
          } else if (
            (opcodes[0] & 0xf0) === 0x80 &&
            (opcodes[1] & 0x0f) === 0x0
          ) {
            dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
              (opcodes[1] & 0xf0) >>
              0x4
            ).toString(16)}\n`;
          }
          break;

        /**
         * 7xkk - ADD Vx, kk
         * 8xy4 - ADD Vx, Vy
         */
        case "ADD":
          if ((opcodes[0] & 0xf0) === 0x70) {
            dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(
              16
            )}, 0x${opcodes[1].toString(16)}\n`;
          } else if (
            (opcodes[0] & 0xf0) === 0x80 &&
            (opcodes[1] & 0x0f) === 0x4
          ) {
            dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
              (opcodes[1] & 0xf0) >>
              0x4
            ).toString(16)}\n`;
          }
          break;

        /**
         * 8xy1 - OR Vx, Vy
         */
        case "OR":
          dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
            (opcodes[1] & 0xf0) >>
            0x4
          ).toString(16)}\n`;
          break;

        /**
         * 8xy2 - AND Vx, Vy
         */
        case "AND":
          dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
            (opcodes[1] & 0xf0) >>
            0x4
          ).toString(16)}\n`;
          break;

        /**
         * 8xy3 - XOR Vx, Vy
         */
        case "XOR":
          dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
            (opcodes[1] & 0xf0) >>
            0x4
          ).toString(16)}\n`;
          break;

        /**
         * 8xy5 - SUB Vx, Vy
         */
        case "SUB":
          dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
            (opcodes[1] & 0xf0) >>
            0x4
          ).toString(16)}\n`;
          break;

        /**
         * 8xy6 - SHR Vx {, Vy}
         */
        case "SHR":
          dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)} {, v${(
            (opcodes[1] & 0xf0) >>
            0x4
          ).toString(16)}}\n`;
          break;

        /**
         * 8xy7 - SUBN Vx, Vy
         */
        case "SUBN":
          dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
            (opcodes[1] & 0xf0) >>
            0x4
          ).toString(16)}\n`;
          break;

        /**
         * Cxkk - RND Vx, byte
         */
        case "RND":
          dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, 0x${(
            opcodes[1] & 0x0f
          ).toString(16)}\n`;
          break;

        /**
         * Dxyn - DRW Vx, Vy, n
         */
        case "DRW":
          dumpText += `${mnemonic} v${(opcodes[0] & 0x0f).toString(16)}, v${(
            (opcodes[1] & 0xf0) >>
            0x4
          ).toString(16)}, 0x${(opcodes[1] & 0x0f).toString(16)}\n`;
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
    this.chip8.halt = false;
    this.chip8.execute();
    this.chip8.halt = true;
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

    this.chip8.halt = false;

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
    this.chip8.halt = true;
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

async function test_draw() {
  let rom = [
    // CLS
    0x00, 0xe0,
    // LD V2, 0x0b
    0x62, 0x0b,
    // LD V3, V2
    0x83, 0x20,
    // LD I, 0x50
    0xa0, 0x50,
    // DRW V2, V3, 5
    0xd2, 0x35,
    // JMP
    0x12, 0x0a,
  ];
  chip8.loadROM(rom);
  return rom;
}

async function test_rnd_draw() {
  let rom = [
    // LD v1, 0x01
    0x61, 0x01,
    // RND V1, 0xde
    0xc1, 0x0f,
    // LD V2, 0x0b
    0x62, 0x0b,
    // LD V3, V2
    0x83, 0x20,

    // default case set I to 0x50
    0xa0, 0x82,

    // check if v1 is 0
    0x41, 0x00,
    // LD I, 0x50
    0xa0, 0x50,
    // check if v1 is 1
    0x41, 0x01,
    // LD I, 0x55
    0xa0, 0x55,
    // check if v1 is 2
    0x41, 0x02,
    // LD I, 0x5a
    0xa0, 0x5a,
    // check if v1 is 3
    0x41, 0x03,
    // LD I, 0x5f
    0xa0, 0x5f,
    // check if v1 is 4
    0x41, 0x04,
    // LD I, 0x64
    0xa0, 0x64,
    // check if v1 is 5
    0x41, 0x05,
    // LD I, 0x69
    0xa0, 0x69,
    // check if v1 is 6
    0x41, 0x06,
    // LD I, 0x6e
    0xa0, 0x6e,
    // check if v1 is 7
    0x41, 0x07,
    // LD I, 0x73
    0xa0, 0x73,
    // check if v1 is 8
    0x41, 0x08,
    // LD I, 0x78
    0xa0, 0x78,
    // check if v1 is 9
    0x41, 0x09,
    // LD I, 0x7d
    0xa0, 0x7d,
    // check if v1 is 10
    0x41, 0x0a,
    // LD I, 0x82
    0xa0, 0x82,
    // check if v1 is 11
    0x41, 0x0b,
    // LD I, 0x87
    0xa0, 0x87,
    // check if v1 is 12
    0x41, 0x0c,
    // LD I, 0x8c
    0xa0, 0x8c,
    // check if v1 is 13
    0x41, 0x0d,
    // LD I, 0x91
    0xa0, 0x91,
    // check if v1 is 14
    0x41, 0x0e,
    // LD I, 0x96
    0xa0, 0x96,
    // check if v1 is 15
    0x41, 0x0f,
    // LD I, 0x9b
    0xa0, 0x9b,

    // DRW V2, V3, 5
    0xd2, 0x35,
    // JMP
    0x12, 0x4c,
  ];
  chip8.loadROM(rom);
  return rom;
}

async function test_generic() {
  let rom = [
    // LD V4, 0x07
    0x64, 0x02,
    // RND V4, 0xde
    0xc4, 0xff,
    // JMP
    0x12, 0x04,
  ];
  chip8.loadROM(rom);
  return rom;
}

/*
 * Entrypoint
 */
async function main() {
  await test_generic();
}

main();

/**
 * Event listeners
 */

// Auto update toggle
document.querySelector("#auto-update").addEventListener("click", (e) => {
  chip8Debugger.toggleAutoUpdate();
  e.currentTarget.innerText = chip8Debugger.autoUpdate
    ? "auto update is on"
    : "auto update is off";
});

/**
 * Update start stop continue button
 * @param {HTMLButtonElement} button
 */
function updateStartStopContinue(button) {
  if (!button) {
    button = document.querySelector("#start-stop-continue");
  }

  if (!chip8Debugger.started) {
    chip8Debugger.continueExecution();
    button.innerText = "stop";
  } else if (chip8Debugger.started && !chip8.halt) {
    chip8Debugger.stopExecution();
    button.innerText = "continue";
  } else if (chip8Debugger.started && chip8.halt) {
    chip8Debugger.continueExecution();
    button.innerText = "stop";
  }
}
document
  .querySelector("#start-stop-continue")
  .addEventListener("click", (e) => {
    updateStartStopContinue(e.currentTarget);
  });
