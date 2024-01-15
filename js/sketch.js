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
        this.specialRegisters = new Uint8Array(2); /* 2, 8-bit registers (delay(0) and sound timers(1)) */
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
        this.frameBuffer = new Uint8Array(this.frameWidth * this.frameHeight); /* 64x32-pixel monochrome display */
    }
} 

const chip8 = new Chip8();
const pixelBlockSize = 0xf;

function setup() {
    // TODO: handle error
    createCanvas(chip8.frameWidth * pixelBlockSize, chip8.frameHeight * pixelBlockSize, WEBGL, document.querySelector('#display'));

    /* TEST: Frame buffer fill */
    for (let p = 0; p < chip8.frameBuffer.length; p++) {
        chip8.frameBuffer[p] = Math.random() > 0.5 ? 1 : 0;
    }
}
  
function draw() {
    background(0);

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
     * |(-32,-15)   (31,-15)|
     * +-------------------+
     */
    stroke(0);
    for (let p = 0; p < chip8.frameBuffer.length; p++) {
        if (chip8.frameBuffer[p] === 1) {
            rect(
                -(pixelBlockSize * chip8.frameWidth)/2 + (pixelBlockSize * (p % chip8.frameWidth)), 
                -(pixelBlockSize * chip8.frameHeight)/2 + (pixelBlockSize * Math.floor(p / chip8.frameWidth)) , 
                pixelBlockSize, 
                pixelBlockSize)
        }
    } 
}