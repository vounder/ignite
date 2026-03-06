package de.drvbund.jauns.main;

public class PerformanceCheck {

	/**
	 * Führt einen kurzen Benchmark aus, indem 10 Millionen Sinus-Berechnungen durchgeführt werden.
	 * <p>
	 * Misst die dafür benötigte Zeit und gibt die Dauer in Millisekunden zurück.
	 * </p>
	 *
	 * @return Die gemessene Zeit des Benchmarks in Millisekunden.
	 */
    public static double benchmarkSinus() {
        long start = System.nanoTime();
        double sum = 0;
        for (int i = 0; i < 10_000_000; i++) {
            sum += Math.sin(i);
        }
        long end = System.nanoTime();
        double durationMs = (end - start) / 1_000_000.0;
        return durationMs; // Zeit in ms
    }

    /**
     * Führt einen Sinus-Benchmark aus und gibt das Ergebnis sowie die empfohlene Animationsstufe auf der Konsole aus.
     * <p>
     * Es wird keine Stufe zurückgegeben – nur eine Textausgabe, wie performant das aktuelle System ist.
     * </p>
     */
    public static void resultPrint() {
        double result = benchmarkSinus();
        System.out.println("Sinus-Benchmark dauerte: " + result + " ms");

		if(result < 300) {
			System.out.println("Ultra Performance! Animationen voll an.");
		} else if (result < 700) {
			System.out.println("High Performance! Animationen auf hoch.");
		} else if (result < 1500) {
			System.out.println("Mittlere Performance. Animationen auf Mittel.");
		} else {
			System.out.println("Low Performance! Animationen minimal, Effekte aus.");
		}
    }
    
    /**
     * Führt einen Sinus-Benchmark aus und ermittelt daraus die empfohlene Animationsstufe.
     * <p>
     * Gibt je nach gemessener Ausführungsdauer einen Wert von 0 (Effekte aus) bis 3 (alle Animationen voll an) zurück.
     * Gibt zusätzlich den Benchmark-Wert und die Stufe auf der Konsole aus.
     * </p>
     *
     * @return Die empfohlene Performance-Stufe (0 = aus, 1 = mittel, 2 = hoch, 3 = voll).
     */
    public static int result() {
        double result = benchmarkSinus();
        System.out.println("Sinus-Benchmark dauerte: " + result + " ms");

		if(result < 300) {
			System.out.println("Ultra Performance! Animationen voll an.");
			return 3;
		} else if (result < 700) {
			System.out.println("High Performance! Animationen auf hoch.");
			return 2;
		} else if (result < 1500) {
			System.out.println("Mittlere Performance. Animationen auf Mittel.");
			return 1;
		} else {
			System.out.println("Low Performance! Animationen minimal, Effekte aus.");
			return 0;
		}
    }
    
}

