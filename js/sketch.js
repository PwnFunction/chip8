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
    this.pixelBlockSize = 0xf; /* 15px x 15px */
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
  }

  reset() {
    /**
     * Resets the Chip-8 interpreter
     */
    this.memory.fill(0x0);
    this.V.fill(0x0);
    this.I = 0x0;
    this.PC = 0x200;
    this.SP = 0x0;
    this.specialRegisters.fill(0x0);
    this.stack.fill(0x0);
    this.frameBuffer.fill(0x0);
  }

  log(type, ...message) {
    /**
     * Logs a message to the console
     * @param {string} type - The type of message
     * @param {string} message - The message to log
     */
    let logTypes = {
      info: "*",
      err: "!",
      succ: "+",
    };
    console.log(logTypes[type], ...message);
  }

  fetch(log = false) {
    /**
     * Fetches one instruction using PC
     *
     * All instructions are 2 bytes long and are stored most-significant-byte
     * first. In memory, the first byte of each instruction should be located
     * at an even addresses.
     */
    const opcodes = [];
    while (opcodes.length < 2) {
      opcodes.push(this.memory[this.PC++]);
    }

    // TODO: MEMORY PROTECTION

    log &&
      this.log(
        "info",
        "[FETCH]",
        `0x${(this.PC - 2).toString(16)}`,
        opcodes.map((i) => `0x${(i || 0).toString(16)}`)
      );

    return opcodes;
  }

  execute(halt = false, log = true) {
    /**
     * Executes one instruction
     */
    const opcodes = this.fetch();
    // temp
    let addr = 0,
      register;

    switch (!halt) {
      /**
       * 00E0 - CLS
       * Clear the display.
       */
      case opcodes[0] === 0x0 && opcodes[1] === 0xe0:
        this.clearFrameBuffer();
        log && this.log("info", "[EXECUTE]", "CLS");
        break;

      /**
       * 1nnn - JP addr
       * Jump to location nnn.
       *
       * The interpreter sets the program counter to nnn.
       */
      case (opcodes[0] & 0xf0) === 0x10:
        addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];
        if (addr < 0x200) {
          log &&
            this.log(
              "err",
              "[EXECUTE]",
              `JMP 0x${addr.toString(16)}`,
              "illegal jump to reserved address"
            );
          throw new Error();
        }
        this.PC = addr;
        log && this.log("info", "[EXECUTE]", `JMP 0x${addr.toString(16)}`);
        break;

      /**
       * 6xkk - LD Vx, byte
       * Set Vx = kk.
       *
       * The interpreter puts the value kk into register Vx.
       */
      case (opcodes[0] & 0xf0) === 0x60:
        // VF write gaurd
        if ((opcodes[0] & 0x0f) === 0xf) {
          log &&
            this.log(
              "err",
              "[EXECUTE]",
              `LD VF, 0x${opcodes[1].toString(16)}`,
              "(VF register is reserved, cannot perform write)"
            );
          throw new Error();
        }

        this.V[opcodes[0] & 0x0f] = opcodes[1];
        log &&
          this.log(
            "info",
            "[EXECUTE]",
            `LD V${(opcodes[0] & 0x0f).toString(16)}, 0x${opcodes[1].toString(
              16
            )}`
          );
        break;

      /**
       * 7xkk - ADD Vx, byte
       * Set Vx = Vx + kk.
       *
       * Adds the value kk to the value of register Vx, then stores the result in Vx.
       */
      case (opcodes[0] & 0xf0) === 0x70:
        // VF write gaurd
        if ((opcodes[0] & 0x0f) === 0xf) {
          log &&
            this.log(
              "err",
              "[EXECUTE]",
              `ADD VF, 0x${opcodes[1].toString(16)}`,
              "(VF register is reserved, cannot perform write)"
            );
          throw new Error();
        }

        this.V[opcodes[0] & 0x0f] += opcodes[1];
        log &&
          this.log(
            "info",
            "[EXECUTE]",
            `ADD V${(opcodes[0] & 0x0f).toString(16)}, 0x${opcodes[1].toString(
              16
            )}`
          );
        break;

      /**
       * Annn - LD I, addr
       * Set I = nnn.
       *
       * The value of register I is set to nnn.
       */
      case (opcodes[0] & 0xf0) === 0xa0:
        addr = ((opcodes[0] & 0x0f) << 8) + opcodes[1];
        this.I = addr;
        log && this.log("info", "[EXECUTE]", `LD I, 0x${addr.toString(16)}`);
        break;

      /**
       * Dxyn - DRW Vx, Vy, nibble
       * Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.
       */

      default:
        log && this.log("err", "[EXECUTE]", "invalid opcode");
        break;
    }
  }

  renderFrame() {
    /**
     * Render the frame buffer
     *
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
   * Render a sprite
   */
  renderSprite(x, y, n) {
    /**
     * Dxyn - DRW Vx, Vy, nibble
     * Display n-byte sprite starting at memory location I at (Vx, Vy),
     * set VF = collision.
     *
     * The interpreter reads n bytes from memory, starting at the address stored
     * in I. These bytes are then displayed as sprites on screen at coordinates
     * (Vx, Vy). Sprites are XORed onto the existing screen. If this causes any
     * pixels to be erased, VF is set to 1, otherwise it is set to 0. If the sprite
     * is positioned so part of it is outside the coordinates of the display, it
     * wraps around to the opposite side of the screen.
     */

    // read n bytes from memory, starting at the address stored in I
    const spriteBytes = this.memory.subarray(chip8.I, chip8.I + n);

    // render sprite
    for (let bytesOffset = 0; bytesOffset < spriteBytes.length; bytesOffset++) {
      let bin = ("00000000" + spriteBytes[bytesOffset].toString(2)).slice(-8);

      for (let bitOffset = 0; bitOffset < bin.length; bitOffset++) {
        this.frameBuffer[
          x + y * this.frameWidth + this.frameWidth * bytesOffset + bitOffset
        ] = bin[bitOffset]; // TODO: XOR
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
}

// Create a new instance of Chip8
const chip8 = new Chip8();
console.log({ chip8 });
let renderClock = 5;
let test = 0;

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
}

/*
 * p5 draw function
 */
async function draw() {
  if (frameCount % renderClock !== 0) {
    return;
  }

  chip8.clearFrameBuffer();
  background(0);
  !chip8.pixelStoke && noStroke();

  // TESTS
  // test++;
  // chip8.I = 0x50 + 5 * (test % 16);
  // chip8.V[0x0] = 0x0;
  // chip8.V[0x1] = 0x0;
  // let n = 5;
  // chip8.renderSprite(chip8.V[0x0], chip8.V[0x1], n);
  // chip8.renderFrame();
}

/*
 * Entrypoint
 */
async function main() {
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

  // exec cycles
  chip8.execute();
  chip8.execute();
  chip8.execute();
  chip8.execute();
  chip8.execute();
  // setInterval(() => chip8.execute(), 0);
}

main();
