# Viborita LCD — cambios solicitados

Implemente los tres cambios siguientes. Cada uno debe desarrollarse en su propia
rama y su propio worktree, en paralelo, y al final los tres deben quedar
integrados en `main`.

## 1. Borrar mejor marca

Agregue un botón "Borrar mejor marca" en la ficha, debajo de la tabla de datos.
Al pulsarlo debe pedir confirmación. Si el jugador acepta, la mejor marca queda
en 0, tanto en pantalla como en el almacenamiento del navegador.

## 2. Manzana dorada

La manzana número 7, 14, 21, etc. de cada partida es dorada:

- vale el triple de puntos;
- se dibuja hueca (solo el contorno del sprite);
- no parpadea.

## 3. Racha

Si la viborita come una manzana 15 pasos o menos después de haber comido la
anterior, esa manzana vale el doble de puntos. La primera manzana de la partida
nunca cuenta como racha.

## Regla de integración

Si una manzana es dorada y además llega en racha, los multiplicadores se
multiplican entre sí: esa manzana vale 6 veces su valor normal.
