package de.drvbund.jauns.main;

/**
 * Enum für alle Spieleffekte mit implementierter Logik.
 * 
 * Jeder Effekt hat ein Emoji zur visuellen Darstellung und eine 
 * ausführen-Methode, die den konkreten Spieleffekt implementiert.
 */
public enum Effekt {

    //-------------Consumables--------------------
    DREI_KARTEN_ZIEHEN("📥") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Implementierung folgt nach GamePlay-Analyse
            System.out.println("Effekt: 3 Karten ziehen");
        }
    },
    
    HAND_NEU_ZIEHEN("🃏") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Implementierung folgt nach GamePlay-Analyse
            System.out.println("Effekt: Neue Hand ziehen");
        }
    },
    
    NAECHSTE_KARTE_VERDOPPELN("🔂") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            gamePlay.setDoppelEffekt(true);
            System.out.println("Effekt: Nächste Karte wird verdoppelt");
        }
    },
    
    GEGNER_KARTE_ENTFERNEN("❎") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Implementierung folgt nach GamePlay-Analyse
            System.out.println("Effekt: Gegner verliert eine Karte");
        }
    },
    
    KARTEN_KOPIERUNG_RUNDE("🖨️") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            gamePlay.setZytokineseEffekt(true);
            System.out.println("Effekt: Karten werden kopiert");
        }
    },
    
    KOSTENLOSES_RECYCLING("♻️") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Implementierung folgt nach GamePlay-Analyse
            System.out.println("Effekt: Kostenloses Recycling");
        }
    },
    
    MUTATION("🦑") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Implementierung folgt nach GamePlay-Analyse
            System.out.println("Effekt: Karten-Mutation");
        }
    },

    //---------------Trinkets--------------------
    SELTENHEITSBOOST_ZUG("⭐") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Passive Effekte werden später implementiert
            System.out.println("Trinket: Seltenheitsboost");
        }
    },
    
    GEGNER_MEHR_STARTKARTEN("📦") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Passive Effekte werden später implementiert
            System.out.println("Trinket: Gegner mehr Startkarten");
        }
    },
    
    ABLAGE_RECYCLING("🔄") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Passive Effekte werden später implementiert
            System.out.println("Trinket: Ablage-Recycling");
        }
    },
    
    CONSUMABLE_VERSTAERKUNGSEFFEKT("✨") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Passive Effekte werden später implementiert
            System.out.println("Trinket: Consumable-Verstärkung");
        }
    },
    
    EXTRA_LEBEN("🩺") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Passive Effekte werden später implementiert
            System.out.println("Trinket: Extra Leben");
        }
    },
    
    KOMBO_GOLD_BONUS("🔗") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Passive Effekte werden später implementiert
            System.out.println("Trinket: Kombo-Goldbonus");
        }
    },
    
    ZUFALLS_ABWURF("🎯") {
        @Override
        public void ausführen(Item item, GamePlay gamePlay) {
            // Passive Effekte werden später implementiert
            System.out.println("Trinket: Zufalls-Abwurf");
        }
    };

    private final String emoji;

    Effekt(String emoji) {
        this.emoji = emoji;
    }

    /**
     * Führt den spezifischen Effekt aus.
     * 
     * @param item Das Item, das den Effekt auslöst
     * @param gamePlay Die aktuelle Spielinstanz
     */
    public abstract void ausführen(Item item, GamePlay gamePlay);

    public String getEmoji() {
        return emoji;
    }

    /**
     * Gibt den formatierten Anzeigenamen des Effekts zurück.
     * 
     * @return Der formatierte Name für die UI
     */
    public String getDisplayName() {
        return this.name().toLowerCase().replace("_", " ");
    }
    
    /**
     * Gibt eine benutzerfreundliche Beschreibung des Effekts zurück.
     * 
     * @return Die Beschreibung des Effekts
     */
    public String getBeschreibung() {
        return switch (this) {
            case DREI_KARTEN_ZIEHEN -> "Ziehe 3 Karten";
            case HAND_NEU_ZIEHEN -> "Erhalte eine neue Hand";
            case NAECHSTE_KARTE_VERDOPPELN -> "Nächste Karte wird doppelt gespielt";
            case GEGNER_KARTE_ENTFERNEN -> "Entferne eine zufällige Karte vom Gegner";
            case KARTEN_KOPIERUNG_RUNDE -> "Kopiere gespielte Karten diese Runde";
            case KOSTENLOSES_RECYCLING -> "Alle Karten vom Ablagestapel zurück ins Deck";
            case MUTATION -> "Verwandle eine Karte in eine zufällige andere";
            case SELTENHEITSBOOST_ZUG -> "Erhöht Chance auf seltene Karten";
            case GEGNER_MEHR_STARTKARTEN -> "Gegner startet mit mehr Karten";
            case ABLAGE_RECYCLING -> "Automatisches Recycling bei leerem Deck";
            case CONSUMABLE_VERSTAERKUNGSEFFEKT -> "Verstärkt Consumable-Effekte";
            case EXTRA_LEBEN -> "Gewährt zusätzliche Leben";
            case KOMBO_GOLD_BONUS -> "Bonus-Gold für Kartenkombos";
            case ZUFALLS_ABWURF -> "Gegner muss Karten abwerfen";
        };
    }
}
