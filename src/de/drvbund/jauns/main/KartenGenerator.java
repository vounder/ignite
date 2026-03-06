package de.drvbund.jauns.main;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.Random;

public class KartenGenerator {

	private static final Random rand = new Random();

	/**
	 * Generiert eine zufällige normale Karte aus dem Standardkartenset.
	 * 
	 * <p>Es wird ein Standarddeck erzeugt und daraus eine zufällige Karte ausgewählt.</p>
	 * 
	 * @return Eine zufällige {@link Karte} aus dem Standarddeck.
	 */
	public static Karte generiereNormaleZufallsKarte() {

		ArrayList<Karte> tempDeck = GamePlay.erzeugeStandardSet();

		Karte karte = tempDeck.get(rand.nextInt(52));

		return karte;

	}

	/**
	 * Generiert eine zufällige Zusatzkarte basierend auf dem aktuellen Spiellevel.
	 * 
	 * <p>Die Methode wählt zufällig eine Zusatzart aus und erstellt eine entsprechende Karte
	 * mit Beschreibung, Effekten und Preis. Skalierbare Effekte passen sich dem Spiellevel an.
	 * Einige Zusatzkarten sind momentan auskommentiert und werden nicht generiert.</p>
	 * 
	 * @return Eine neu generierte {@link Karte} mit einem Zusatzkarteneffekt.
	 * @throws IllegalStateException Wenn ein unbekannter EffektTyp ausgewählt wird.
	 */
	public static Karte generiereZufallsZusatzkarte() {
		KartenBuilder builder = new KartenBuilder();

		int spielLevel = GameState.getInstance().getLevel();

		// Zufällig eine Zusatzart wählen
		int effektTyp = rand.nextInt(11); // 0–10
		int basis = Math.max(1, spielLevel);

		switch (effektTyp) {
		case 0: // AUSSETZEN
			return builder.setBeschreibung("Der Gegner setzt eine Runde aus.")
					.setZusätze(EnumSet.of(Zusatzkarte.AUSSETZEN)).setPreis(basis * 2).build();

		case 1: // ADDIEREN (skalierbar)
			int ziehen = basis + rand.nextInt(2);
			return builder.setBeschreibung("Der Gegner zieht " + ziehen + " Karte(n).").setAddierWert(ziehen)
					.setZusätze(EnumSet.of(Zusatzkarte.ADDIEREN)).setPreis(ziehen * 2).build();

//        case 2: // SPIEGEL
//            return builder.setBeschreibung("Spiegelt Spezialeffekte zurück zum Absender.")
//                    .setZusätze(EnumSet.of(Zusatzkarte.SPIEGEL))
//                    .setPreis(basis * 3)
//                    .build();

		case 2: // TAUSCH
			return builder.setBeschreibung("Tauscht deine Hand mit der des Gegners.")
					.setZusätze(EnumSet.of(Zusatzkarte.TAUSCH)).setPreis(basis * 3).build();

//        case 4: // DOPPEL
//            return builder.setBeschreibung("Die erste Karte der nächsten Runde hat doppelten Effekt.")
//                    .setZusätze(EnumSet.of(Zusatzkarte.DOPPEL))
//                    .setPreis(basis * 2)
//                    .build();

//        case 3: // SPEZIALBLOCK (skalierbar)
//            return builder.setBeschreibung("Spezialkarten wirken " + basis + " Runden lang nicht.")
//                    .setBlockRundenAnzahl(basis)
//                    .setZusätze(EnumSet.of(Zusatzkarte.SPEZIALBLOCK))
//                    .setPreis(basis * 2)
//                    .build();

//        case 6: // ZERSTÖRUNG (skalierbar)
//            return builder.setBeschreibung("Zerstört " + basis + " Karte(n) des Gegners.")
//                    .setZerstörungAnzahl(basis)
//                    .setZusätze(EnumSet.of(Zusatzkarte.ZERSTÖRUNG))
//                    .setPreis(basis * 3)
//                    .build();

		case 3: // FLUCH (skalierbar)
			return builder.setBeschreibung("Der Gegner zieht zusätzlich " + basis + " Karte(n).")
					.setFluchRundenAnzahl(basis).setZusätze(EnumSet.of(Zusatzkarte.FLUCH)).setPreis(basis * 2).build();

		case 4: // BONUSGELD (skalierbar)
			int geldMult = 1 + rand.nextInt(1 + basis);
			return builder.setBeschreibung("Verdient " + geldMult + "x so viel Geld.").setBonusGeldMult(geldMult)
					.setZusätze(EnumSet.of(Zusatzkarte.BONUSGELD)).setPreis(geldMult * 2).build();

		case 5: // SPY (skalierbar)
			int spyRunden = 1 + rand.nextInt(basis + 1);
			return builder.setBeschreibung("Sieht gegnerische Karten für " + spyRunden + " Runden.")
					.setKartenAnguckenRundenAnzahl(spyRunden).setZusätze(EnumSet.of(Zusatzkarte.SPY))
					.setPreis(spyRunden * 2).build();

//        case 10: // VERBRENNEN
//            return builder.setBeschreibung("Wirf eine Karte auf der Hand ab.")
//                    .setZusätze(EnumSet.of(Zusatzkarte.VERBRENNEN))
//                    .setPreis(2)
//                    .build();
//
//        case 11: // VORHERSAGE
//            return builder.setBeschreibung("Sieht die nächsten 3 Karten.")
//                    .setZusätze(EnumSet.of(Zusatzkarte.VORHERSAGE))
//                    .setPreis(4)
//                    .build();
//
//        case 12: // GESPENST
//            return builder.setBeschreibung("Wirkt den Effekt nochmal nach 2 Runden.")
//                    .setZusätze(EnumSet.of(Zusatzkarte.GESPENST))
//                    .setPreis(4)
//                    .build();

		case 6: // OPFER
			return builder.setBeschreibung("Wirf 2 Karten ab und erhalte 5 Coins.")
					.setZusätze(EnumSet.of(Zusatzkarte.OPFER)).setPreis(2).build();

		case 7: // ZOCKEN
			return builder.setBeschreibung("Zieh 3 Karten – spiele eine mit Effekt sofort.")
					.setZusätze(EnumSet.of(Zusatzkarte.ZOCKEN)).setPreis(3).build();

		case 8: // ZYTOKINESE
			return builder.setBeschreibung("Diese Karte wird zu 2 neuen Karten.")
					.setZusätze(EnumSet.of(Zusatzkarte.ZYTOKINESE)).setPreis(4).build();

		case 9: // ZYTOKINESE2
			return builder.setBeschreibung("Diese Karte wird zu 2 neuen Spezialkarten.")
					.setZusätze(EnumSet.of(Zusatzkarte.ZYTOKINESE2)).setPreis(6).build();

		case 10: // HODL (skalierbar)
			int hodlGeld = basis + 2;
			return builder.setBeschreibung("Setzt aus und verdient " + hodlGeld + " Coins.").setHodlWert(hodlGeld)
					.setZusätze(EnumSet.of(Zusatzkarte.HODL)).setPreis(hodlGeld).build();

		default:
			throw new IllegalStateException("Unbekannter EffektTyp: " + effektTyp);
		}

	}

	/**
	 * Upgradet eine Karte mit skalierbaren Effekten basierend auf dem aktuellen
	 * Spiel-Level. Für jeden Zusatz werden Werte gesetzt, Preis angepasst und eine
	 * Beschreibung generiert.
	 *
	 * Effekte wie ADDIEREN, HODL, FLUCH usw. werden dabei dynamisch mit
	 * Zufallskomponenten und Basiswerten versehen. Einige Effekte haben fixe
	 * Beschreibungen und Preise.
	 *
	 * @param karte Die Karte, die upgedatet werden soll.
	 */
	public static void kartenUpgrade(Karte karte) {
		StringBuilder beschreibung = new StringBuilder();

		int basis = Math.max(1, GameState.getInstance().getLevel() / 3);

		if (karte.getZusätze() != null) {
			for (Zusatzkarte effekt : karte.getZusätze()) {
				switch (effekt) {
				case ADDIEREN -> {
					int ziehen = basis + rand.nextInt(2);
					karte.setAddierWert(ziehen);
					karte.setPreis(karte.getPreis() + (ziehen * 2));
					beschreibung.append("Der Gegner zieht ").append(ziehen).append(" Karte")
							.append(ziehen > 1 ? "n" : "").append(". ");
				}

				case HODL -> {
					int geld = basis + 2;
					karte.setHodlWert(geld);
					karte.setPreis(karte.getPreis() + geld);
					beschreibung.append("Du setzt aus und bekommst ").append(geld).append(" Münze(n). ");
				}

				case FLUCH -> {
					karte.setFluchRundenAnzahl(basis);
					karte.setPreis(karte.getPreis() + basis * 2);
					beschreibung.append("Der Gegner zieht pro Zug ").append(basis).append(" zusätzliche Karte(n). ");
				}

//                case ZERSTÖRUNG -> {
//                    karte.setZerstörungAnzahl(basis);
//                    karte.setPreis(karte.getPreis() + basis * 3);
//                    beschreibung.append("Es werden ").append(basis).append(" gegnerische Karte(n) zerstört. ");
//                }

				case BONUSGELD -> {
					int mult = 1 + rand.nextInt(basis + 1);
					karte.setBonusGeldMult(mult);
					karte.setPreis(karte.getPreis() + mult * 2);
					beschreibung.append("Du bekommst ").append(mult).append("x so viel Geld. ");
				}

				case SPY -> {
					int runden = 1 + rand.nextInt(basis + 1);
					karte.setKartenAnguckenRundenAnzahl(runden);
					karte.setPreis(karte.getPreis() + runden * 2);
					beschreibung.append("Du siehst die Hand des Gegners für ").append(runden).append(" Runde(n). ");
				}

				case AUSSETZEN -> {
					int runden = 1 + rand.nextInt(basis + 1);
					karte.setAussetzWert(runden);
					karte.setPreis(karte.getPreis() + 3);
					beschreibung.append("Der Gegner setzt eine Runde aus. ");
				}
				// ───── Nicht-skalierbare Effekte mit fixer Beschreibung ─────

//                case SPIEGEL -> {
//                    karte.setPreis(karte.getPreis() + 4);
//                    beschreibung.append("Spezialeffekte werden auf den Gegner zurückgeworfen. ");
//                }

				case TAUSCH -> {
					karte.setPreis(karte.getPreis() + 5);
					beschreibung.append("Du tauschst deine Hand mit der des Gegners. ");
				}

//                case DOPPEL -> {
//                    karte.setPreis(karte.getPreis() + 3);
//                    beschreibung.append("Die erste Karte der nächsten Runde hat doppelten Effekt. ");
//                }
//
//                case VERBRENNEN -> {
//                    karte.setPreis(karte.getPreis() + 2);
//                    beschreibung.append("Du darfst eine Karte aus deiner Hand abwerfen. ");
//                }
//
//                case VORHERSAGE -> {
//                    karte.setPreis(karte.getPreis() + 3);
//                    beschreibung.append("Du siehst die nächsten 3 Karten, die du ziehst. ");
//                }
//
//                case GESPENST -> {
//                    karte.setPreis(karte.getPreis() + 4);
//                    beschreibung.append("Der Effekt dieser Karte tritt nach 2 Runden erneut auf. ");
//                }

				case OPFER -> {
					karte.setPreis(karte.getPreis() + 2);
					beschreibung.append("Wirf 2 Karten ab und erhalte 5 Münzen. ");
				}

				case ZOCKEN -> {
					karte.setPreis(karte.getPreis() + 4);
					beschreibung.append("Ziehe 3 Karten – wenn eine einen Effekt hat, wird sie sofort gespielt. ");
				}

				case ZYTOKINESE -> {
					karte.setPreis(karte.getPreis() + 4);
					beschreibung.append("Diese Karte verwandelt sich in 2 neue Karten. ");
				}

				case ZYTOKINESE2 -> {
					karte.setPreis(karte.getPreis() + 6);
					beschreibung.append("Diese Karte verwandelt sich in 2 neue Spezialkarten. ");
				}

				default -> {
					// nichts tun
				}
				}
			}
		}

		// Bestehende Beschreibung behalten und anhängen
		String alt = karte.getBeschreibung();
		if (alt != null && !alt.isBlank()) {
			beschreibung.insert(0, alt + " ");
		}

		karte.setBeschreibung(beschreibung.toString().trim());
	}

	/**
	 * Upgradet eine Karte aus dem Standard-Set mit zusätzlichen Effekten und
	 * Beschreibung.
	 * 
	 * Je nach Zusatzkarte werden spezifische Werte gesetzt und die Beschreibung
	 * ergänzt: - ADDIEREN: Gegner muss 2 Karten ziehen. - AUSSETZEN: Gegner muss
	 * eine Runde aussetzen.
	 * 
	 * Die bestehende Beschreibung der Karte wird erhalten und erweitert.
	 * 
	 * @param karte Die Karte, die upgedatet werden soll.
	 */
	public static void kartenUpgradeStandardSet(Karte karte) {
		StringBuilder beschreibung = new StringBuilder();

		if (karte.getZusätze() != null) {
			karte.setBeschreibung(
					String.format("%s %s: ", karte.getFarbe().getDisplayName(), karte.getNummer().getDisplayName()));

			for (Zusatzkarte effekt : karte.getZusätze()) {
				switch (effekt) {
				case ADDIEREN -> {
					karte.setAddierWert(2);
					beschreibung.append("Der Gegner zieht ").append(2).append(" Karten.");
				}

				case AUSSETZEN -> {
					karte.setAussetzWert(1);
					beschreibung.append("Der Gegner setzt eine Runde aus. ");
				}

				default -> {
					// nichts tun
				}
				}
			}
		}

		// Bestehende Beschreibung behalten und anhängen
		String alt = karte.getBeschreibung();
		if (alt != null && !alt.isBlank()) {
			beschreibung.insert(0, alt + " ");
		}

		karte.setBeschreibung(beschreibung.toString().trim());
	}

}
