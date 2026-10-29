/* LogiCade's educational game API, implemented by the browser C-subset runtime.
 * These helpers are not part of the ISO C library. This declaration file is
 * documentation; the browser does not invoke a native compiler or linker.
 */
#ifndef LOGICADE_H
#define LOGICADE_H
int readInput(void);
int writeOutput(double value);
int observe(double value);
int moveRight(int steps);
int moveLeft(int steps);
int moveUp(int steps);
int moveDown(int steps);
#endif
