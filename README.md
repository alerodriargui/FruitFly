# Fruit Fly Brain en Windows

Instalación local del modelo público [eonsystemspbc/fly-brain](https://github.com/eonsystemspbc/fly-brain), asociado al trabajo de Eon Systems sobre la mosca virtual. Código original en `vendor/fly-brain-main`, revisión `a3db62f9436074e485c0278290c2164ed6150808` (licencia GPL-2.0-or-later; se conservan sus avisos).

Se utiliza el backend original PyTorch en CPU, Python 3.10 y los datos FlyWire v783 incluidos en el repositorio. Este entorno es una instalación mínima para Windows con gráfica Intel. No incluye los backends CUDA/GeNN/NEST ni el cuerpo virtual del vídeo.

## Probar

### Explorar un entorno con cuerpo y física: NeuroMechFly

Haz doble clic en **`explorar-mosca.cmd`** y deja abierta la consola del servidor. Abre `http://127.0.0.1:8766/habitat.html`. El cuerpo camina automáticamente por una ruta de laboratorio; puedes cambiar a control manual con **W/A/S/D**, detener la marcha con **Q**, pausar la física, modificar la fricción o girar y acercar la cámara. **Espacio** reinicia cuando el visor tiene el foco.

Se ejecuta el modelo biomecánico oficial de [NeuroMechFly/FlyGym](https://neuromechfly.org/outreach/) y su controlador CPG con MuJoCo WebAssembly, instalado localmente. En esta configuración hay **67 articulaciones, 48 actuadores y un paso físico de 0,1 ms**. Se calculan gravedad, contactos, adhesión de patas y movimiento articulado. El contador de contactos y la distancia proceden del estado físico de MuJoCo. La reproducción empieza a 0,1× para observar los apoyos; el rendimiento conseguido aparece dentro del visor.

**Esta prueba prioriza cuerpo y física. No conecta el cerebro de Eon, no aprende y no simula vuelo ni olfato.** La ruta automática es una regla diseñada a mano que envía dos señales al controlador locomotor original. Las alas son geometría del cuerpo. El terreno es una arena plana con postes, no un hábitat natural completo. El cambio de fricción multiplica las componentes tangenciales de las parejas de contacto explícitas y de las geometrías; ×1 conserva el original.

Los 50 archivos oficiales (14,8 MB) se descargaron de la revisión de la web `0884af08981994543634563d95e9b1eb49945082` y se verificaron con sus hashes Git antes de adaptar la interfaz. `web/habitat/upstream-manifest.json` recoge revisión, tamaños y SHA-256 originales. `build_habitat.py` añade un punto de integración a `game.js`; las mallas, el XML MuJoCo, las tablas de marcha y el controlador CPG se conservan. `web/habitat/adapt.js` implementa navegación, cámara y controles. `install_habitat.py` restaura los archivos oficiales y `build_habitat.py` vuelve a aplicar la integración.

Créditos: NeuroMechFly / NeLy-EPFL y colaboradores, modelo basado en microtomografía de una mosca adulta; MuJoCo / Google DeepMind; Three.js. Se incluyen las licencias Apache-2.0 y MIT en `web/habitat/`. Fuentes: [modelo y características](https://neuromechfly.org/), [implementación oficial del visor](https://github.com/NeLy-EPFL/flygym/tree/main/wasm/game).

`check_habitat.py` comprueba movimiento físico, contactos, estado numérico, pausa, órdenes manuales, cambio de fricción y renderizado en Chrome. Evidencia: `results/habitat-validation.json` y `results/habitat.png`.

### Ver a la mosca aprender Flappy Bird

Haz doble clic en **`jugar-flappy.cmd`**. Abre `http://127.0.0.1:8766/flappy.html` y comienza a entrenar en un hilo del navegador mientras ves volar al controlador actual. El servidor solo escucha en el equipo local y sirve la carpeta `web`. Mantén abierta su ventana de consola mientras lo usas; puedes detenerlo con Ctrl+C.

- **Pausar aprendizaje** detiene el entrenamiento al acabar la generación en curso; el vuelo continúa.
- **Ver sin entrenar** compara el controlador inicial, que no aletea, con el aprendido sobre el mismo recorrido.
- **1× / 3× / 8×** cambia la velocidad del vuelo mostrado, no la física ni el entrenamiento.
- **Repetir vuelo** carga el controlador más reciente al empezar de nuevo el recorrido.
- El progreso se conserva en `localStorage` del navegador. **Guardar controlador** descarga sus pesos, métricas y la huella del circuito. **Empezar de cero** borra ese aprendizaje local y reinicia.

#### Qué se ejecuta y qué aprende

Es una adaptación interactiva, **no el modelo completo de 138.639 neuronas ni su dinámica Brian2/PyTorch**. `build_flappy.py` selecciona 48 neuronas de proyección visual con gran conectividad y sus principales destinos, hasta completar 192 neuronas, conservando las 6.652 conexiones internas no nulas y su signo. Los identificadores y los pesos originales están en `web/flappy-circuit.js`. Las entradas de cada neurona se normalizan a una suma absoluta de 0,65 para estabilizar el reservorio reducido.

Se emplea una actualización `tanh` por decisión, con ocho señales diseñadas para el juego (posición respecto al hueco, velocidad, distancia al obstáculo y otras referencias geométricas), repartidas en grupos. No se simulan retina, músculos ni percepción biológica. El dibujo de la mosca es una animación del juego y el gráfico del circuito es esquemático.

Solo se entrenan **17 pesos de lectura** sobre medias de actividad, medias de actividad al cuadrado y un sesgo. La decisión usa la actividad del circuito; el controlador no recibe un atajo directo de las coordenadas. Las conexiones FlyWire permanecen fijas. Cada generación prueba 26 controladores en 3 recorridos de entrenamiento, conserva los mejores y adapta la distribución de la siguiente población (método de entropía cruzada). La recompensa favorece sobrevivir y pasar tubos, con una pequeña penalización por alejarse del hueco.

La gráfica usa otros tres recorridos fijos, que no intervienen en la selección del controlador. La puntuación de evaluación puede fluctuar: mejorar en entrenamiento no garantiza mejorar en todos los recorridos. El vuelo visible usa semillas adicionales. Las generaciones de entrenamiento se limitan a 3.600 pasos por recorrido; el vuelo visible, a 7.200 pasos. La gravedad y las colisiones son iguales en ambos.

`check_flappy.py` verifica aprendizaje y mejora en evaluación, vuelo con el controlador aprendido, comparación, exportación y restauración. Guarda la evidencia en `results/flappy-validation.json` y capturas en `results/flappy-learning.png` y `results/flappy-mobile.png`.

### Visualizar el cerebro en 3D

Haz doble clic en **`visualizar.cmd`** para regenerar y abrir el atlas local. También puedes abrir directamente `web/index.html` una vez generado.

Arrastra para girar, usa la rueda para acercar y pulsa sobre una neurona para inspeccionarla. Puedes filtrar grupos, mostrar solo las neuronas activas, ver conexiones o reproducir los impulsos del experimento de azúcar. La línea temporal permite comparar con el reposo. Los 100 ms se reproducen en unos 10 segundos; el brillo dura 5 ms simulados para facilitar la lectura.

La posición corresponde al soma cuando está disponible y, en otros casos, a un punto de referencia anatómico real. La cobertura exacta se muestra en «Qué estás viendo». Las líneas son conexiones del modelo entre esos puntos, no reconstrucciones de los axones. No se muestran las ramificaciones completas de las neuronas.

Las coordenadas y anotaciones proceden de [flyconnectome/flywire_annotations](https://github.com/flyconnectome/flywire_annotations), archivo `supplemental_files/Supplemental_file1_neuron_annotations.tsv`: Schlegel et al. (2024), Dorkenwald et al. (2024), Matsliah et al. (2024) y Berg et al. (2025). Se cruzan por ID FlyWire v783, conservado como texto para evitar pérdida de precisión en el navegador. Se convierten los vóxeles 4×4×40 nm a micrómetros antes de representar la geometría. El archivo descargado está en `data/neuron_annotations.tsv`; su SHA-256 queda registrado en los datos exportados.

`build_viewer.py` genera `web/brain-data.js` con las coordenadas y la última prueba de azúcar de `results/summary.json`. Las conexiones se limitan a las 2.500 de mayor peso absoluto entre neuronas activas para mantener la vista legible. El atlas funciona sin servidor ni recursos externos una vez generado; los enlaces a las fuentes y fichas individuales sí requieren Internet.

`check_viewer.py` comprueba el renderizado WebGL y los controles con Playwright y el Chrome instalado.

### Ejecutar la prueba de azúcar

Haz doble clic en **`probar.cmd`**. Compara 100 ms de reposo con 100 ms de estimulación de las 21 neuronas gustativas de azúcar del experimento original, a 200 Hz. Abre un informe con la gráfica al terminar.

Desde PowerShell, en esta carpeta:

```powershell
.\probar.cmd
# Una prueba más larga (puede tardar bastante en CPU):
.\probar.cmd --seconds 1
```

Resultados en `results/informe.html`, `results/actividad.png`, `results/summary.json` y archivos Parquet con los impulsos individuales. Cada repetición sustituye los resultados de la misma duración; el registro `demo.log` se amplía. Se fija la semilla aleatoria en 42 por condición.

La prueba comprueba que el reposo no genera impulsos y que el estímulo produce actividad fuera de las neuronas estimuladas. Es una comprobación funcional breve, no una validación biológica ni una demostración de aprendizaje o conciencia.

## Ejecutar el programa original

```powershell
.\.venv\Scripts\python.exe vendor\fly-brain-main\main.py --pytorch --t_run 0.1 --n_run 1 --experiment sugar --no_log_file
```

Evita ejecutar `main.py` sin parámetros: sus valores predeterminados lanzan una batería extensa para múltiples backends.

## Entorno

- `.tools/`: uv y Python local.
- `.venv/`: dependencias aisladas del proyecto.
- `vendor/`: código y datos originales descargados desde GitHub.
- `requirements-lock.txt`: versiones instaladas para reproducir este entorno.

Para reinstalar las dependencias con las herramientas locales:

```powershell
.\.tools\uv.exe --system-certs pip install --python .venv\Scripts\python.exe -r requirements-lock.txt
```

El código, los entornos y los datos descargados no se añaden al repositorio Git propio. El origen Git de FruitFly se conserva.
