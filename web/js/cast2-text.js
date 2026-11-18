/* Zündung – Texte der zweiten Besetzung (3.0): Sprüche am Tisch (ZU.SAY2) und Akten (ZU.LORE).
   Aufbau wie in js/data.js (say) und js/lore.js. Wird vor js/cast2.js geladen. */
(function (ZU) {
  'use strict';

  ZU.SAY2 = {
    'lottery-girl': {
      start: ['Lose, Lose, Lose! Jedes Los gewinnt! … Fast jedes!', 'Juhu, Kundschaft! Der Teddy wartet seit 1931 auf dich!'],
      attack: ['Niete! Macht nix, zieh gleich noch eins!', 'Trostpreis! Den darfst du behalten!'],
      hurt: ['Huch! Ein Treffer! Gratuliere … glaub ich!', 'Autsch! Und ich gab dir extra das gute Los!'],
      nervous: ['Moment, Moment! Die Trommel klemmt! Ehrlich!', 'Du ziehst doch nicht etwa den Hauptgewinn?!'],
      gloat: ['Noch ein Los? Die Nieten gehen heute weg wie nix!', 'Gleich hast du alle Nieten! Auch ein Rekord!'],
      win: ['Leider verloren! Aber so schön verloren! Komm wieder!'],
      lose: ['Hauptgewinn! … Den Teddy kriegst du trotzdem nicht.']
    },
    'knife-thrower': {
      start: ['Stell dich ans Brett. Stillhalten.', 'Ich treff immer daneben. Mit Absicht.'],
      attack: ['Tschak. Zwei Finger neben dem Ohr.', 'Nicht zucken. Zieh.'],
      hurt: ['… Gestreift.', 'Das Brett wirft zurück. Neu.'],
      nervous: ['Meine Hand. Die ist sonst ruhig.', 'Noch ein Wurf. Der muss sitzen.'],
      gloat: ['Letztes Messer. Atme aus.', 'Tschak. Jetzt ziel ich nicht mehr daneben.'],
      win: ['Kein Kratzer. Sag danke.'],
      lose: ['… Getroffen. Mich. Das gab es lange nicht.']
    },
    'boss-zampano': {
      start: ['Hereinspaziert! Sensationell! Nie dagewesen: ein Mensch, der noch hofft!', 'Treten Sie näher! Hier ist jede Bude gezinkt – und ich bin die größte!'],
      attack: ['Und – SENSATIONELL! Applaus für mich!', 'Das, verehrtes Publikum, nennt man Lehrgeld!'],
      hurt: ['Eine Unverschämtheit! Eine … sensationelle Unverschämtheit!', 'Das gehört nicht zur Nummer! Wer hat das geprobt?!'],
      nervous: ['Verehrtes Publikum, kleine Pause! Technik! TECHNIK!', 'Nie dagewesen … und so hätte es auch bleiben dürfen!'],
      gloat: ['Trommelwirbel! Vor Ihren Augen verschwindet: Ihr Glück!', 'Die Hauptattraktion: Ihr Untergang! Eintritt frei!'],
      win: ['Sensationell! Die Vorstellung ist aus. Der Ausgang ist dort!'],
      lose: ['Sie haben den Rummelkönig geschlagen. Nie dagewesen. Leider.']
    },
    'jockey': {
      start: ['Startbox zu! Ich reite, du wartest. Hast du was zu essen?', 'Neunundvierzig Kilo. Rat mal, wovon ich träume. Knödel.'],
      attack: ['Friss das! … Ach, wenn ich doch nur dürfte.', 'Die gehen weg wie warme Semmeln. Mmh … Semmeln.'],
      hurt: ['Uff! Voll in den leeren Magen!', 'Schwer wie Schweinebraten. Ach … Schweinebraten.'],
      nervous: ['Mir wird schwarz vor Augen. Hunger. Oder du.', 'Nicht jetzt! Ich hab seit Dienstag nix im Bauch!'],
      gloat: ['Zielgerade! Ich riech schon das Siegerbuffet!', 'Noch eine Länge. Dann gibt es Kuchen. Zum Anschauen.'],
      win: ['Sieg! Jetzt ein Salatblatt. Ein ganzes!'],
      lose: ['Verloren … Egal. Heute gibt es Schnitzel. Mit allem.']
    },
    'vet': {
      start: ['Nächster Fall. Hinsetzen, Ärmel hoch.', 'Befund: zu viel Hoffnung. Das lässt sich behandeln.'],
      attack: ['Das piekst jetzt kurz.', 'Dosis verdoppelt. Wirkung in drei, zwei, eins.'],
      hurt: ['Reflexe vorhanden. Bedauerlich.', 'Befund: Sie wehren sich. Selten in diesem Stall.'],
      nervous: ['Mein Puls? Geht Sie nichts an. Hundertvierzig.', 'Das Mittel schlägt nicht an. Das Mittel schlägt IMMER an!'],
      gloat: ['Prognose: ungünstig. Für Sie.', 'Ich stelle den Schein schon aus. Natürliche Ursache.'],
      win: ['Exitus. Der nächste Fall, bitte.'],
      lose: ['Befund: Niederlage. Ursache: … nicht natürlich.']
    },
    'boss-toto': {
      start: ['Graf Toto, auf Ehre. Sie dürfen sitzen, solange Sie verlieren.', 'Willkommen auf Silberhuf. Alles meins. Dem Anschein nach.'],
      attack: ['Um eine Nasenlänge, auf Ehre!', 'Schreiben Sie es an. Auf Ihre Rechnung, versteht sich.'],
      hurt: ['Unerhört! In meiner eigenen Loge!', 'Das war gegen die Etikette. Und gegen meine Kasse.'],
      nervous: ['Fotofinish! Ich verlange ein Fotofinish!', 'Hätten Sie bis Dienstag etwas flüssig? Der Form halber.'],
      gloat: ['Mein Pferd geht durchs Ziel. Sie durchs Tor. Zu Fuß.', 'Noch eine Nasenlänge. Sie dürfen schon gratulieren.'],
      win: ['Ein Ehrensieg! Den Pokal bezahle ich später.'],
      lose: ['Auf Ehre … Der Titel bleibt mir. Mehr war ohnehin nie da.']
    },
    'conductor': {
      start: ['Die Fahrkarten, bitte! … Aha. Zweite Klasse. Dachte ich mir.', 'Abfahrt 23 Uhr 14. Verlieren ab 23 Uhr 15. Bitte einsteigen!'],
      attack: ['Knips! Ungültig. Sie setzen aus.', 'Zuschlag! Nachzulösen sofort und bei mir.'],
      hurt: ['Das verstößt gegen die Beförderungsordnung!', 'Sachbeschädigung an der Zange! Das wird notiert!'],
      nervous: ['Verspätung?! In dreißig Jahren keine Minute!', 'Wir halten nicht. Wir halten NIE. Zurückbleiben, bitte!'],
      gloat: ['Nächster Halt für Sie: Endstation.', 'Knips, knips. Gleich ist Ihr Fahrschein voll.'],
      win: ['Fahrt beendet. Bitte alles aussteigen. Also Sie.'],
      lose: ['… Fahrschein gültig. Erste Klasse. Ich loche nicht.']
    },
    'countess': {
      start: ['Komtess Coupé, sehr erfreut. Gestern noch von Waggon. Unwichtig.', 'Haltung ist alles. Der Rest findet sich im Gepäck. In Ihrem.'],
      attack: ['Ein Bube? Bei mir heißt der, wie ich will.', 'Pardon, gleich zwei. In meinen Kreisen ist das üblich.'],
      hurt: ['Verdammich noch … Pardon. Haltung. Haltung!', 'Autsch! Äh … wie überaus unstandesgemäß.'],
      nervous: ['Welcher Pass war das heute? Der blaue? Der BLAUE?!', 'Ich steige am nächsten Bahnhof … ach. Er hält ja nicht.'],
      gloat: ['Ihre Brieftasche und ich, wir verstehen uns bereits.', 'Noch eine Karte, dann reise ich mit Ihrem Koffer weiter.'],
      win: ['Es war mir ein Vergnügen. Ihr Gepäck übrigens auch.'],
      lose: ['Na schön. Behalten Sie den Namen. Ich hab noch sechs.']
    },
    'boss-else': {
      start: ['Volldampf, Brunhilde! Wir haben Besuch auf dem Führerstand!', 'Der Zug hält erst, wenn mich jemand schlägt. Also nie.'],
      attack: ['Siehst du, Brunhilde? Das war erst der Leerlauf!', 'Runter vom Gleis mit dir!'],
      hurt: ['He! Finger weg von meinem Kessel!', 'Das war nur eine Weiche, Brunhilde. Nur eine Weiche.'],
      nervous: ['Der Druck fällt … Brunhilde, lass mich nicht hängen!', 'Wer zieht da die Notbremse?! LOSLASSEN!'],
      gloat: ['Hörst du die Pfeife? Die pfeift auf dich.', 'Dreißig Züge, dann bist du abgefahren. Laut Fahrplan.'],
      win: ['Wer nicht mitkommt, bleibt im Schnee. Gute Reise!'],
      lose: ['Bremsen, Brunhilde … Nach dreißig Jahren. Wir halten.']
    },
    'usher': {
      start: ['Verzeihung. Formblatt A38, zweifach. Ich trage das nur aus.', 'Ihr Vorgang? Liegt bei mir. Alles liegt bei mir.'],
      attack: ['Zwei Anlagen zum Vorgang. Bitte gegenzeichnen.', 'Das ist nur der Dienstweg. Der ist lang.'],
      hurt: ['Oh. Das muss ich leider zu den Akten nehmen.', 'Vierzig Dienstjahre. Geschubst hat mich nie jemand.'],
      nervous: ['Moment, die Akte … die lag eben noch hier!', 'Bitte nicht so schnell. Ich bin nur der Bote.'],
      gloat: ['Ihr Vorgang ist gleich abgeschlossen. Ablage P.', 'Noch ein Stempel. Dann sind Sie erledigt. Amtlich.'],
      win: ['Zu den Akten. Dritter Gang links. Liest keiner.'],
      lose: ['Sehr wohl. Abgelegt unter … Wunder. Aktenzeichen folgt.']
    },
    'police-chief': {
      start: ['Na, na, na! Keine Angst, die Razzia ist erst morgen. Hoho!', 'Von Knüppel, Polizei. Unter uns: Was ist Ihnen ein Sieg wert?'],
      attack: ['Beschlagnahmt! Quittung gibt es keine. Hoho!', 'Im Namen des Gesetzes. Also in meinem.'],
      hurt: ['Hoppla! Widerstand gegen die Staatsgewalt!', 'Au! Die Nase! Nicht schon wieder die Nase!'],
      nervous: ['Regeln wir das auf dem kleinen Dienstweg. Wie viel?', 'Schrank! Brock! … Ach so. Die stehen ja woanders.'],
      gloat: ['Hoho! Gleich klicken die Handschellen. Bildlich gesprochen.', 'Sie haben das Recht zu verlieren. Nutzen Sie es.'],
      win: ['Akte zu. Den Rest hefte ich ab. Hoho!'],
      lose: ['Hoho … ho. Das steht in keinem Bericht. Was kostet Ihr Schweigen?']
    },
    'boss-mayor': {
      start: ['Nur herein, nur herein! Ich lasse jeden herein. Was soll schon sein?', 'Ich bin nur ein einfacher Bürger. Mit Amtskette.'],
      attack: ['Liebe Mitbürgerinnen und Mitbürger … wo war ich? Ach ja. Ziehen Sie.', 'Das habe ich unterschrieben? Dann wird es wohl stimmen.'],
      hurt: ['Aber, aber! Wir sind doch alle Demokraten!', 'Das trifft mich. Als Mensch und als Behörde.'],
      nervous: ['Riecht es hier nach Rauch? Ach was. Einbildung.', 'Hundert Jahre im Amt, die Familie! Da ist nie etwas passiert!'],
      gloat: ['Ich komme zum Schluss meiner Rede. Und zu Ihrem.', 'Wo darf ich unterschreiben? Ah, hier: Ihre Niederlage.'],
      win: ['Sehen Sie? Es ist gar nichts passiert. Prösterchen!'],
      lose: ['Ich bin doch nur ein einfacher Bürger … Ich habe nur aufgemacht.']
    },
    'coat-check': {
      start: ['Mantel her, Kindchen. Und Taschen leeren, ich seh es doch.', 'Deine Marke. Nummer dreizehn. Nicht verlieren, Kindchen!'],
      attack: ['Schau an, was im Ärmel steckt: eine Dame!', 'Das lag noch in deiner Tasche, Kindchen. Nimm nur.'],
      hurt: ['Na, na! So zerrt man nicht am Mantel!', 'Ach Kindchen. Und ich hab dir den guten Bügel gegeben.'],
      nervous: ['Wo hab ich denn … Die Marke! Wo ist die Marke?!', 'Die Garderobe so voll. Und mein Blatt so leer.'],
      gloat: ['Zieh dich warm an, Kindchen. Gleich geht es raus.', 'Dein Mantel bleibt. Ich heb alles auf, was liegen bleibt.'],
      win: ['Kopf hoch, Kindchen. Den Mantel kriegst du morgen wieder.'],
      lose: ['Bitte schön, dein Mantel. Es fehlt nichts. Fast nichts.']
    },
    'gigolo': {
      start: ['Darf ich bitten? Man nennt mich den Schönen Egon. Immer noch.', 'Bezaubernd, ganz bezaubernd! Schade, dass Sie verlieren.'],
      attack: ['Damenwahl! Und die Dame wählt: mich. Noch einmal.', 'Bezaubernd, wie Sie ziehen. Ziehen Sie ruhig weiter.'],
      hurt: ['Vorsicht, die Frisur! Die hält nur bei gutem Wetter.', 'Au, mein Kreuz … Früher ging das ohne Knacken.'],
      nervous: ['Ich bin außer Atem. Das ist die Pomade. Die drückt.', 'Könnten wir langsamer …? Die Kapelle hetzt heute so.'],
      gloat: ['Der letzte Walzer gehört mir. Bitte lächeln.', 'Bezaubernd! Gleich liegen Sie mir zu Füßen. Aus Versehen.'],
      win: ['Es war mir ein Tanz. Die Rechnung geht wie immer an Sie.'],
      lose: ['Bezaubernd … verloren. Erzählen Sie es bitte keiner Witwe.']
    },
    'dancer': {
      start: ['Hallöchen, Krümel~ Ich bin die Kitty. Rück mal.', 'Ich spar auf eine Bäckerei, Krümel. Du zahlst die Kacheln.'],
      attack: ['Kusshand~ Und du bleibst schön sitzen. Zwei Runden.', 'Ups! War das mein Ellbogen? Der ist aber auch spitz.'],
      hurt: ['Aua! Nicht auf die Füße! Die sind mein Kapital!', 'So? Dann backen wir jetzt kleinere Brötchen. DEINE.'],
      nervous: ['Jetzt mal halblang, Zuckerstück! Ich hab noch Schicht!', 'Das ist mein Mehlgeld! Finger weg von meinem Mehlgeld!'],
      gloat: ['Gleich bist du durch, Krümel. Außen kross, innen leer~', 'Noch ein Küsschen zum Abschied? Macht fünf Mark.'],
      win: ['Tschüssi, Krümel~ Danke für die Kacheln!'],
      lose: ['Na gut, Zuckerstück. Du kriegst ein Brötchen. Von gestern.']
    },
    'photographer': {
      start: ['Bitte recht freundlich! … Zu spät. Hab Sie schon. Hehe.', 'Hübsches Blatt. Kommt gut raus auf dem Abzug. Hehe.'],
      attack: ['Puff! Geblendet? Das gibt sich. Hehe.', 'Der Abzug kostet extra. Das Negativ noch mehr.'],
      hurt: ['Nicht aufs Objektiv! Das ist geliehen!', 'He! Die Platte war noch nicht entwickelt!'],
      nervous: ['Verwackelt … alles verwackelt! Die Linse beschlägt!', 'Wir können über die Negative reden. Über alle. Hehe … he.'],
      gloat: ['Das Bild geht morgen an den Verleger. Hehe.', 'Noch eine Aufnahme. Kinn hoch, Sie verlieren so schön.'],
      win: ['Im Kasten! Der Abzug geht Ihnen zu. Gegen Gebühr. Hehe.'],
      lose: ['Hehe … Das hier hat niemand fotografiert. Einverstanden?']
    },
    'cook': {
      start: ['Moin. Gibt Labskaus. Gibt immer Labskaus. Hinsetzen.', 'Erst Salz über die Schulter. Toi, toi, toi. So. Nu du.'],
      attack: ['Nachschlag! Wird aufgegessen.', 'Noch ne Kelle. Is genug da.'],
      hurt: ['Du hast das Salz verschüttet! Dat gibt Unglück!', 'Nich in meinen Topf spucken!'],
      nervous: ['Die Suppe wird kalt. Dat is kein gutes Zeichen.', 'Dreimal auf Holz … wo is hier Holz?! Allens Blech!'],
      gloat: ['Teller leer machen. Is gleich so weit.', 'Riechst du dat? Angebrannt. Du, nich ich.'],
      win: ['Abgeräumt. Morgen gibt es Labskaus.'],
      lose: ['Versalzen. Und zwar mir. Toi, toi … ach, lass.']
    },
    'first-mate': {
      start: ['Erste Offizierin Sturm. Ich habe Wache. Sie haben Pech.', 'Melde: unbekanntes Blatt an Steuerbord. Wird abgefangen.'],
      attack: ['Melde: Treffer. Mittschiffs.', 'Befehl von der Brücke. Sie ziehen.'],
      hurt: ['Melde: Wassereinbruch. Gering.', 'Das trage ich ins Buch ein. Ins dritte.'],
      nervous: ['Melde … Schlagseite. Kein Wort zur Kapitänin!', 'Alle Mann an die Pumpen! Ich meine: ich. An die Pumpen.'],
      gloat: ['Melde: Gegenseite manövrierunfähig.', 'Klar zum Entern. Hände weg vom Blatt.'],
      win: ['Wache beendet. Keine besonderen Vorkommnisse.'],
      lose: ['Melde: Wache verloren. Ich sag es der Kapitänin selbst.']
    },
    'sprayer': {
      start: ['Klack-klack. … Dein Platz? Jetzt meiner.', 'Nicht anlehnen. Frisch.'],
      attack: ['Zisch. Getaggt.', 'Klack-klack. Noch ne Schicht drüber.'],
      hurt: ['Ey. Nicht crossen.', '… Verlaufen. Egal. Mal ich über.'],
      nervous: ['Dose leer. Dose LEER.', 'Klack … klack … kommt nix mehr.'],
      gloat: ['Gleich bist du übermalt.', 'Letzte Farbe. Rot. Passt zu dir.'],
      win: ['Mein Name. Deine Wand. Tschau.'],
      lose: ['… Okay. Dein Name bleibt stehen. Ich mal nicht drüber.']
    },
    'dj': {
      start: ['Hundertachtundzwanzig BPM. Du hältst das nicht durch.', 'Rechtes Ohr, bitte. Das linke ist taub. Oder schweig.'],
      attack: ['Drei, zwei, eins – Drop.', 'Bass rein. Du raus.'],
      hurt: ['Was? Falsches Ohr. … Ah. Das hat gesessen.', 'Du bist aus dem Takt. Das stört mich. Sehr.'],
      nervous: ['Rückkopplung! Wer hat an meinem Pult gedreht?!', 'Die Platte springt … nicht jetzt, nicht jetzt, nicht jetzt …'],
      gloat: ['Letzter Track. Noch sechzehn Takte, dann Licht an.', 'Ich blend dich schon mal aus.'],
      win: ['Set vorbei. Danke fürs Tanzen.'],
      lose: ['… Stille. Auf beiden Ohren. Du legst auf.']
    },
    'maid': {
      start: ['Füße hoch, ich wische! Und Ihre Karten gleich mit.', 'Zimmerservice! Ich mach hier nur schnell sauber. Mit Ihnen.'],
      attack: ['Hier, das lag unterm Bett. Gehört sicher Ihnen.', 'Husch, husch! Ziehen, nicht krümeln!'],
      hurt: ['Na! Ich hab hier gerade erst gewischt!', 'Ein Fleck! Auf MEINER Schürze!'],
      nervous: ['Das krieg ich nicht mehr raus … nie mehr raus!', 'Moment, ich muss in Zimmer zwölf. Dringend. Sofort!'],
      gloat: ['Gleich sind Sie weggewischt. Blitzblank.', 'Noch einmal drüber, dann glänzt der Tisch. Ohne Sie.'],
      win: ['Blitzblank! „Bitte nicht stören“ hängt jetzt an Ihrer Tür.'],
      lose: ['… Na gut. Den Fleck lass ich. Als Andenken an Sie.']
    },
    'detective': {
      start: ['Es war spät. Sie kamen herein. Ich wusste gleich: Ärger.', 'Ich hab Sie seit der Lobby im Blick. Schönes Blatt übrigens.'],
      attack: ['Ich hab es kommen sehen. Ich seh alles kommen.', 'Wer Tricks spielt, zahlt nach. Alte Hotelregel.'],
      hurt: ['Das stand nicht in meinen Notizen.', 'Autsch. Die Nacht wurde davon nicht kürzer.'],
      nervous: ['Die Spur war heiß. Leider führte sie zu mir.', 'Ich bin zu müde für so was. Seit Jahren.'],
      gloat: ['Der Fall war klar. Es fehlte nur noch das Geständnis.', 'Ich kenn Ihr Blatt. Ich kenn auch das Ende.'],
      win: ['Fall gelöst. Ich leg mich hin.'],
      lose: ['Fall ungelöst. Ich schweige dazu. Darin hab ich Übung.']
    },
    'slot-tech': {
      start: ['Moment, da klemmt was … So. Läuft wieder. Gegen dich.', 'Einwurf ein Groschen. Auszahlung: mal sehen. Eher nicht.'],
      attack: ['Kirsche, Kirsche, Kirsche – Pling! Zwei für dich.', 'Ratter, ratter … Pling! Das war Absicht.'],
      hurt: ['He! Nicht gegen den Kasten treten!', 'Auszahlung?! Der ist doch auf knapp gestellt!'],
      nervous: ['Da ist ne Schraube locker. Hoffentlich bei dir.', 'Nicht rütteln! Wer rüttelt, fliegt raus!'],
      gloat: ['Noch drei Prozent knapper. Extra für dich.', 'Zwei Kirschen stehen schon. Rat mal, was kommt.'],
      win: ['Pling! Kasse voll. Bitte nachwerfen.'],
      lose: ['Jackpot. Ein ehrlicher. Dass ich das noch erleb … Pling.']
    },
    'pit-boss': {
      start: ['Bonsoir. Ich sehe alles im Saal. Auch Ihre linke Hand.', 'Alors. Die Hälfte gehört der Bank. Der Rest bald auch.'],
      attack: ['Zéro. Die Bank behält ein.', 'Voilà. Nicht kommen sehen, n\'est-ce pas?'],
      hurt: ['Non. Das habe ich nicht genehmigt.', 'Pardon? In MEINEM Saal?'],
      nervous: ['Alors … das ist mir entgangen. Mir entgeht nichts!', 'Wer hat diesen Tisch freigegeben? WER?'],
      gloat: ['Tant pis. Für Sie.', 'Ich zähle Ihre Karten. Es dauert nicht mehr lange.'],
      win: ['Zéro. Für Sie. Bonne nuit.'],
      lose: ['Alors. Ich habe nichts gesehen. Noch nicht.']
    },
    'imp': {
      start: ['Post vom Chef! Ein Fluch, doppelt, per Eilboten!', 'Schwefel-Fritz, Lehrjahr dreihundert! Die Stelle hat Aussichten!'],
      attack: ['Zustellung! Annahme verweigern geht nicht!', 'Hui! Schönen Gruß von ganz unten!'],
      hurt: ['Autsch! Das melde ich … ach nee. Gibt nur Nachsitzen.', 'Hui, heiß! Und ich bin Hitze gewohnt!'],
      nervous: ['Nicht verlieren, Fritz! Sonst: Lehrjahr vierhundert!', 'Der Chef guckt doch nicht zu? Der guckt immer zu!'],
      gloat: ['Gleich hab ich ausgelernt! Diesmal bestimmt!', 'Ich hätte da noch einen Umschlag. Rot. Nur zum Angucken.'],
      win: ['Zugestellt! Unterschrift brauch ich keine. Noch nicht!'],
      lose: ['Na prima. Noch hundert Jahre Lehre. Trinkgeld?']
    },
    'notary': {
      start: ['Erschienen, Komma, ohne Vertrag, Komma, Sie. Unerträglich.', 'Setzen Sie sich. Die Tinte ist warm. Der Stuhl auch.'],
      attack: ['Klausel vier, Doppelpunkt: Sie ziehen. Punkt.', 'Nichtig. Formfehler. Ich bedaure nicht.'],
      hurt: ['Einspruch, Komma, unzulässig. Und doch … interessant.', 'Sie haben meine Feder verbogen. Das kommt ins Protokoll.'],
      nervous: ['Das ist nicht beurkundet! Das GILT nicht!', 'Absatz. Neuer Absatz! Ich brauche einen Absatz!'],
      gloat: ['Es fehlt nur Ihre Unterschrift. Hier unten. Ganz unten.', 'Schlussformel, Doppelpunkt: Sie verlieren. Punkt.'],
      win: ['Gelesen, genehmigt, verloren. Punkt.'],
      lose: ['Kein Name, Komma, keine Schuld, Komma, kein Vertrag. Unerträglich.']
    },
    'dice-girl': {
      start: ['Pfff! Einmal pusten – und du bist geliefert!', 'Drei Sechser auf der Hand! Na ja. So ähnlich.'],
      attack: ['Pasch! Die gehen an dich!', 'Plopp! Na, wer hat hier das Glück gepachtet?'],
      hurt: ['Ey! Die war angepustet!', 'Mist. Jetzt hab ich den Kaugummi verschluckt!'],
      nervous: ['Pusten, pusten, PUSTEN … nix?!', 'Sag bloß Papa nicht, dass ich verlier!'],
      gloat: ['Noch einmal pusten, dann ist Sense!', 'Schmeckt nach Sieg. Und nach Erdbeer.'],
      win: ['Plopp! Gewonnen! Im RICHTIGEN Casino!'],
      lose: ['Auf dem Rummel gäb es jetzt wenigstens einen Trostpreis.']
    },
    'granny': {
      start: ['Setz dich, Kindchen. Bonbon? Du wirst es brauchen.', 'Zwei rechts, zwei links – und du fällst von der Nadel.'],
      attack: ['Nimm nur, Kindchen. Es ist genug da.', 'Das hat noch keinem geschadet. Außer dir.'],
      hurt: ['Na, na! So geht man nicht mit alten Leuten um!', 'Jetzt ist mir eine Masche gefallen. Deinetwegen!'],
      nervous: ['Früher hätte es so was nicht gegeben!', 'Wo ist meine Brille? Das kann doch nicht stimmen!'],
      gloat: ['Noch eine Karte, Kindchen, dann ruf ich es.', 'Halt dir schon mal die Ohren zu.'],
      win: ['BINGO! … Und zieh dir was Warmes an, Kindchen.'],
      lose: ['Hm. Nimm ein Bonbon. Eins. Du hast es dir verdient.']
    },
    'scrap-dealer': {
      start: ['Alteisen, Lumpen, Papier! … Und du.', 'Schöner Tisch. Brennt sicher gut. Den merk ich mir.'],
      attack: ['Kannste behalten. Ist eh nix wert.', 'Zwei Stück Ramsch. Frei Haus.'],
      hurt: ['Vorsicht! Das war noch gut!', 'Delle drin. Jetzt gibt es nur noch Kilopreis.'],
      nervous: ['Mein Karren! Wer passt auf den Karren auf?!', 'So viel Schrott auf einer Hand. Auf MEINER!'],
      gloat: ['Dich lad ich gleich mit auf.', 'Was übrig bleibt, nehm ich. Also dich.'],
      win: ['Aufgeladen. Der Rest wird eingeschmolzen.'],
      lose: ['Na schön. Zünd an. Ich komm dann mit dem Karren.']
    },
    'tourist': {
      start: ['Verzeihung, ist hier noch frei? Wie geht das Spiel?', 'Im Reiseführer steht: unbedingt einmal mitspielen!'],
      attack: ['Oh! War das gut? Das war gut, oder?', 'Verzeihung! Ich wollte die Karte nur loswerden.'],
      hurt: ['Darf man das? Steht das irgendwo?', 'Moment, das schlage ich eben nach …'],
      nervous: ['Ist das jetzt schlecht für mich? Seien Sie ehrlich.', 'Ich hätte die Stadtrundfahrt nehmen sollen.'],
      gloat: ['Ich hab kaum noch Karten. Ist das normal?', 'Bitte lächeln! Das kommt ins Album.'],
      win: ['Gewonnen? Ich? Na so was. Gibt es eine Urkunde?'],
      lose: ['Macht nichts. Wissen Sie zufällig, wo mein Bus steht?']
    },
    'newsboy': {
      start: ['Extrablatt! Neuling setzt sich an den falschen Tisch!', 'Zeitung von morgen? Steht schon drin, wie du verlierst.'],
      attack: ['Extrablatt! Zwei Karten, null Chance!', 'Sondermeldung! Und ich bin gleich nochmal dran!'],
      hurt: ['Ey! Das stand so nicht in der Zeitung!', 'Das druckt mir keiner. Zum Glück.'],
      nervous: ['Haltet die Presse an! HALTET DIE PRESSE AN!', 'Morgen steht was anderes drin. Ehrlich!'],
      gloat: ['Letzte Meldung: Du bist gleich blank!', 'Seite eins! Mit Bild! Du, heulend!'],
      win: ['Extrablatt! Zeitungsjunge schlägt Großmaul! Zehn Pfennig!'],
      lose: ['Gegendarstellung. Seite acht. Ganz unten. Winzig.']
    },
    'chimney-sweep': {
      start: ['Einmal am Knopf drehen? Bringt Glück. Mir.', 'Toi, toi, toi! Du wirst es brauchen.'],
      attack: ['Schwarz bringt Glück. Nur eben nicht dir.', 'Da! Frisch aus dem Kamin gefallen.'],
      hurt: ['Uff. Ruß im Auge.', 'Flüche perlen ab. Das da leider nicht.'],
      nervous: ['Dreimal auf Holz … wo ist hier Holz?!', 'Der Knopf! Hat jemand meinen Knopf gesehen?!'],
      gloat: ['Gleich wird gekehrt. Von oben nach unten.', 'Dein Glück zieht gerade durch den Schornstein ab.'],
      win: ['Sauber gekehrt. Toi, toi, toi fürs nächste Mal!'],
      lose: ['Na so was. Fass an den Knopf. Hast es dir verdient.']
    },
    'magician': {
      start: ['Verehrtes Publikum! Heute verschwindet: Ihr Glück!', 'Ziehen Sie eine Karte. Irgendeine. Nein, nicht die.'],
      attack: ['Simsalabim! Und schon haben Sie mehr davon.', 'Ist DAS Ihre Karte? Jetzt ja.'],
      hurt: ['Vorsicht! Das Kaninchen erschrickt so leicht!', 'Kein Applaus? Nicht einmal ein höflicher?'],
      nervous: ['Abrakadabra … Abrakadabra! … Hm.', 'Sonst klappt das immer! Fragen Sie das Kaninchen!'],
      gloat: ['Und nun: der Trick mit der leeren Hand!', 'Nichts im Ärmel. Und fast nichts auf der Hand.'],
      win: ['Tadaa! Der Große Bellini dankt. Spenden in den Hut.'],
      lose: ['Der Zauberer verschwindet. Das war … Absicht.']
    },
    'crypto-bro': {
      start: ['Bro. BRO. Das hier ist eine Riesenchance. Für mich.', 'Ich bin früh eingestiegen. Du bist mein Exit, Bro.'],
      attack: ['To the Moon! Und du hältst die Bags, Bro.', 'Kein Verlust, Bro. Das ist ein Airdrop!'],
      hurt: ['Nur ein Dip, Bro. Nur ein Dip.', 'Ich verkauf nicht. Ich VERKAUF nicht!'],
      nervous: ['Bro, der Chart … der geht ja nach UNTEN?!', 'Nicht aufs Portfolio schauen. Nicht hinschauen …'],
      gloat: ['Bullish, Bro. Mega bullish.', 'Gleich bin ich oben. Mond, Bro. MOND.'],
      win: ['Sag ich doch: früh einsteigen. Peace, Bro.'],
      lose: ['Alles gut, Bro. Langfristig … bin ich pleite.']
    },
    'nurse': {
      start: ['Na, wie geht es uns heute? Gleich schlechter.', 'Zwölf Stunden Schicht. Halt mich wach, ja?'],
      attack: ['Das piekst jetzt kurz.', 'So, jetzt nehmen wir brav unsere Karten.'],
      hurt: ['Autsch. Das nähe ich mir selbst.', 'Halb so wild. Hab Schlimmeres verbunden.'],
      nervous: ['Mir geht es blendend. Hm-hm-hmm …', 'Nicht einschlafen, Agnes. Nicht jetzt!'],
      gloat: ['Gleich vorbei. Tut gar nicht weh. Hm-hmm …', 'Wir atmen ruhig. Und geben auf.'],
      win: ['Entlassen. Auf eigene Gefahr. Und jetzt: Bettruhe.'],
      lose: ['Gute Besserung. Also … mir. Gute Nacht.']
    },
    'taxi': {
      start: ['Wohin, Chef? Egal. Die Uhr läuft schon.', 'Steig ein. Äh – setz dich. Gewohnheit.'],
      attack: ['Klick. Macht eine Karte, Chef.', 'Kleiner Umweg. Kostet extra.'],
      hurt: ['He! Nicht auf die Polster!', 'Das war eine Einbahnstraße, Chef!'],
      nervous: ['Rote Welle. Ausgerechnet jetzt!', 'Sackgasse?! Die war gestern noch nicht da!'],
      gloat: ['Endstation, Chef. Alles aussteigen.', 'Hörst du die Uhr ticken, Chef? Wird teuer.'],
      win: ['Macht zwölf Mark achtzig. Trinkgeld ist Ehrensache.'],
      lose: ['Die Fahrt geht auf mich, Chef. Ich warte draußen.']
    },
    'commissar': {
      start: ['Kommissar … äh, Müller. Ich spiele hier nur.', 'Beachten Sie mich nicht. Ich ermittle verdeckt.'],
      attack: ['Razzia! … Verzeihung. Berufskrankheit.', 'Beweisstück A. Gehört jetzt Ihnen.'],
      hurt: ['Widerstand gegen die Staatsgewalt! … Sagte ich Staat?', 'Das kommt in den Bericht. Seite vierhundert.'],
      nervous: ['Ich fordere Verstärkung an! … Es kommt nie welche.', 'Meine Tarnung! Hat jemand etwas gemerkt?'],
      gloat: ['Sie sind umstellt. Von mir.', 'Der Fall steht kurz vor der Aufklärung.'],
      win: ['Fall gelöst. Der erste in elf Jahren.'],
      lose: ['Ich ermittle weiter. Jahr zwölf. Verdeckt.']
    },
    'twins': {
      start: ['„Ich bin Hinz –“ „– nein, ich. Glaub ich.“', '„Wir spielen immer –“ „– zu zweit. Du nicht.“'],
      attack: ['„Eine für dich –“ „– und noch eine von mir!“', '„Das war –“ „– ich!“ „Nein, ich!“'],
      hurt: ['„Au!“ „Wieso Au? Getroffen hat es doch mich!“', '„Das tat –“ „– weh!“ „Mir zuerst!“'],
      nervous: ['„Wir verlieren?“ „Unmöglich. Höchstens –“ „– du.“', '„Tauschen wir die Plätze?“ „Haben wir schon.“'],
      gloat: ['„Gleich sind wir –“ „– fertig mit dir.“', '„Letzte Karte!“ „Meine!“ „Nein –“ „– unsere.“'],
      win: ['„Gewonnen hat –“ „– Kunz!“ „Wer von uns ist das?“'],
      lose: ['„Verloren hat –“ „– der andere.“ „Eindeutig.“']
    },
    'hypnotist': {
      start: ['Sehen Sie auf die Uhr. Sie werden müde … sehr müde.', 'Bei drei vergessen Sie, wie man gewinnt. Eins …'],
      attack: ['Ihre Lider werden schwer. Ihre Hand auch.', 'Sie wollen diese Karten. Sie wissen es nur noch nicht.'],
      hurt: ['Das haben Sie nicht getan. Sie erinnern sich nicht.', 'Auf die Uhr! Sie sollen auf die UHR sehen!'],
      nervous: ['Sie werden müde! … Bitte. Werden Sie müde.', 'Warum pendelt das nicht?! Halten Sie still!'],
      gloat: ['Gleich schlafen Sie. Tief und teuer.', 'Drei … zwei … Sie spüren es schon …'],
      win: ['Wenn ich schnipse, wachen Sie auf. Ohne Geld.'],
      lose: ['Sie wollen gar nichts vergessen? Dann bin ich machtlos.']
    },
    'heiress': {
      start: ['Unterhalten Sie mich. Dividende langweilt sich auch.', 'Geld spielt keine Rolle. Es spielt für mich.'],
      attack: ['Hier. Ich habe so viele davon.', 'Sitz, Dividende. Und Sie: ziehen.'],
      hurt: ['Oh. Ein Gefühl. Wie ungewohnt.', 'Sieh nur, Dividende: Jemand gibt sich Mühe.'],
      nervous: ['Verlieren? Ich? Na endlich passiert einmal etwas.', 'Papa kauft den Tisch. Dann zählt das nicht.'],
      gloat: ['Gähn. Sind wir bald fertig?', 'Ich gewinne schon wieder. Wie eintönig.'],
      win: ['War es das? Komm, Dividende. Mir ist fad.'],
      lose: ['Bravo. Nehmen Sie reichlich. Es ist Papas Geld.']
    },
    'chess-master': {
      start: ['Ich kenne Ihre nächsten zwölf Züge. Sie sind schwach.', 'Glück gibt es nicht. Ich beweise es Ihnen.'],
      attack: ['Schach.', 'Ein Gambit. Sie haben es angenommen. Fehler.'],
      hurt: ['Ein Bauernopfer. Geplant. … Größtenteils.', 'Das war kein Zug. Das war Zufall. Pfui.'],
      nervous: ['Zugzwang? ICH?', 'Ich biete Remis. Nehmen Sie an. Bitte.'],
      gloat: ['Matt in drei. Sie dürfen noch zappeln.', 'Ihr König steht nackt da. Bildlich gesprochen.'],
      win: ['Schachmatt. Mit Glück hatte das nichts zu tun.'],
      lose: ['Ich lege den König um. Sie hatten … Glück. Leider.']
    },
    'auctioneer': {
      start: ['Zum Aufruf kommt: Ihr Abend! Höre ich ein Gebot?', 'Schnell, bitte! Um neun versteigere ich die nächste Ruine.'],
      attack: ['Eine Karte, bietet wer mehr? Niemand? An Sie!', 'Zum Ersten, zum Zweiten – verkauft! An Sie!'],
      hurt: ['Einspruch nach dem Zuschlag gilt nicht!', 'Das stand so nicht im Katalog!'],
      nervous: ['Höre ich Mitleid? Zum Ersten? … Niemand?', 'Langsam, langsam! … Das sage ich sonst nie.'],
      gloat: ['Zum Ersten … zum Zweiten … na?', 'Losnummer eins: Ihr letztes Hemd. Wer bietet?'],
      win: ['Und zum Dritten! Verkauft. Abholung auf eigene Kosten.'],
      lose: ['Zuschlag an Sie. Den Hammer behalte ich.']
    },
    'boss-baron': {
      start: ['Gestatten: Baron, General, Nordpolfahrer. Ehrenwort!', 'Ich spiele nie um Geld. Ich habe ja keines. Ehrenwort.'],
      attack: ['Wie damals auf der Kanonenkugel: Volltreffer!', 'Dieses Ass? Ein Bube. Ehrenwort. Ziehen Sie.'],
      hurt: ['Ein Kratzer! Der Tiger damals war schlimmer.', 'Das hat nicht wehgetan. … Das war gelogen.'],
      nervous: ['Ich zog mich einst am eigenen Zopf aus dem Sumpf …', 'Ich verliere nie! … Auch das war gelogen.'],
      gloat: ['Mein tausendster Sieg! Oder der erste. Einerlei.', 'Gleich gewinne ich. Diesmal sogar wirklich!'],
      win: ['Sieg! Morgen erzähle ich, es waren zehn Gegner.'],
      lose: ['Geschlagen. Das ist die Wahrheit. Sie schmeckt scheußlich.']
    },
    'boss-abbess': {
      start: ['Setz dich, mein Kind. Hast du schon gebüßt? Nein?', 'Wir spielen für einen guten Zweck: meinen.'],
      attack: ['Das ist keine Strafe, mein Kind. Das ist Buße.', 'Geben ist seliger denn Nehmen. Also nimm.'],
      hurt: ['Ich vergebe dir. Das Lineal vergibt nicht.', 'Auch noch die andere Wange? Nein, mein Kind.'],
      nervous: ['Herr, gib mir Geduld. Und eine Sieben. Sofort.', 'Eine Prüfung. Ich verabscheue Prüfungen.'],
      gloat: ['Sprich dein Gebet, mein Kind. Ein kurzes.', 'Gleich geht die Kollekte herum. Du gibst alles.'],
      win: ['Gehe hin in Frieden. Dein Geld bleibt hier. Amen.'],
      lose: ['Der Herr hat es gegeben, du hast es genommen. Amen.']
    },
    'boss-judge': {
      start: ['Die Verhandlung ist eröffnet. Das Urteil steht fest.', 'Angeklagt: Sie. Richter: ich. Noch Fragen? Abgewiesen.'],
      attack: ['Schuldig! Strafmaß: eine Karte.', 'Im Namen des Tisches: Ziehen Sie.'],
      hurt: ['Einspruch! … Stattgegeben. Von mir, für mich.', 'Das ist Missachtung des Gerichts!'],
      nervous: ['Die Sitzung wird vertagt! Auf nie!', 'Was kostet bei Ihnen ein Freispruch? Rein hypothetisch.'],
      gloat: ['Haben Sie ein letztes Wort? Kurz, bitte.', 'Mildernde Umstände? Ich sehe keine. Ich sehe nie welche.'],
      win: ['Schuldig in allen Punkten. Die Kosten tragen Sie.'],
      lose: ['Freispruch. Mangels Karten. … Abführen. Mich.']
    },
    'boss-publisher': {
      start: ['Ich kenne Ihr Blatt. Es stand heute früh in meinem.', 'Sie verlieren. Punkt. Das ist bereits gedruckt.'],
      attack: ['Schlagzeile. Sie dürfen sie ausbaden.', 'Fortsetzung folgt. Zu Ihrem Nachteil.'],
      hurt: ['Das ist nie geschehen. Streichen.', 'Eine Ente. Ich dementiere. Absatz.'],
      nervous: ['Druckstopp! Die ganze Auflage zurück!', 'Wer hat das redigiert?! So stand das nicht im Manuskript!'],
      gloat: ['Der Nachruf auf Ihren Abend ist schon gesetzt.', 'Redaktionsschluss. Für Sie.'],
      win: ['Morgen lesen Sie, wie es war. Ich habe es beschlossen.'],
      lose: ['Gut. Das drucken wir nicht. Also ist es nie geschehen. Punkt.']
    }
  };

  ZU.LORE = ZU.LORE || {};
  ZU.LORE['lottery-girl'] = [
    'Hanni verkauft Lose, seit sie über den Tresen der Bude schauen kann. „Jedes Los gewinnt!“, ruft sie und meint es beinahe ehrlich. Der Hauptgewinn, ein Teddy mit nur einem Knopfauge, hängt seit 1931 am selben Haken.',
    'Texas-Theo ist ihr Onkel, der echte. Den Schieber und Rico nennt sie auch so, weil beide hier angefangen haben und ihr bis heute Lose abkaufen. Rico hat in all den Jahren nur Nieten gezogen. Er hält die Trommel für gezinkt. Aus seinem Mund, sagt Hanni, ist das ein Kompliment.',
    'Das Los für den Teddy wurde nie gedruckt. Im Bären steckt, was Direktor Zampano nicht in seinem Wagen haben will: der erste Räumungsbescheid der Stadt, ungeöffnet. Was man nicht aufmacht, gilt nicht, sagt er. Hanni hat die Naht selbst gesetzt. Seitdem ruft sie noch etwas lauter.'
  ];
  ZU.LORE['knife-thrower'] = [
    'Messer-Marek wirft zwölf Klingen in vier Sekunden, jede eine Handbreit neben das Ziel. Das ist Absicht. Er redet wenig, trinkt Malzkaffee und trifft seit Jahren genau dorthin, wo er will: knapp daneben.',
    'Er stand im Zelt, als der Schieber und die spätere Kapitänin Fortuna sich um ein Blatt und eine Flasche stritten. Danach fehlte ihr ein Auge und ihm die Lust am Schnaps. Der Schieber sagt, das gehe auf seine Rechnung. Marek sagt dazu gar nichts.',
    'Die Flasche war seine, das Messer auch. Der Schieber nahm es auf sich und hat nie gesagt, was er dafür will. Zampano behielt Marek, ohne Gage; was er so spart, geht jede Woche als Schutzgeld an Donna Scarlatta. Marek wirft also seit Jahren für die Patin. Knapp daneben.'
  ];
  ZU.LORE['boss-zampano'] = [
    'Direktor Zampano kündigt alles an, auch sich selbst: sensationell, nie dagewesen, nur heute. Auf seinem Rummel ist jede Bude gezinkt, und er ist stolz auf jede einzelne. Wer bei ihm verliert, hat laut Plakat trotzdem etwas erlebt.',
    'Der Schieber und Rico haben bei ihm gelernt, an drei Hütchen und einer Erbse. Texas-Theo war sein Partner, bis nur noch einer von beiden bluffen wollte. Seine Tochter Wanda lief ihm davon, zu den „richtigen Casinos“. Ihr Bild hängt im Direktionswagen, zwischen den Plakaten.',
    'Zampano zahlt Schutzgeld an Donna Scarlatta und steht dafür pünktlich in ihrem Buch. Gegen die Stadt hilft es nicht: Der Platz ist nur gepachtet, per Handschlag mit einem früheren Biedermann. Jetzt will die Stadt an die Spielbank verkaufen. Einen Handschlag kann man nicht vorlegen.'
  ];
  ZU.LORE['jockey'] = [
    'Flo Fliegengewicht wiegt neunundvierzig Kilo mit Sattel und hungert dafür seit Jahren. Er kennt die Speisekarte jedes Lokals der Stadt auswendig und hat aus keiner je bestellt. Im Rennen denkt er an Knödel. Es macht ihn schnell.',
    'Einmal hat er ein Rennen absichtlich verloren, für Quoten-Otto, gegen ein Abendessen, das er dann nicht anrührte. Otto war danach drei Wochen lang flüssig, sein persönlicher Rekord. Die beiden grüßen sich seither wie Leute, die zusammen etwas vergraben haben.',
    'Einmal hat er absichtlich gewonnen, für sich, auf einem Außenseiter aus dem Stall des Grafen. Der Totalisator im Keller hatte anders gerechnet, und die Spielbank musste auszahlen. Das hat ihm keiner verziehen. Seitdem wiegt man Flo vor jedem Start zweimal und hofft auf ein Gramm zu viel.'
  ];
  ZU.LORE['vet'] = [
    'Dr. Spritze behandelt auf Silberhuf alles, was vier Beine hat, und manches mit zweien. Ihre Diagnosen sind kurz, ihre Rezepte stehen in keinem Lehrbuch. Was sie spritzt, wirkt bis zur Ziellinie. Was danach kommt, ist nicht mehr ihr Fachgebiet.',
    'Sie hat Brunos Kiefer geflickt, nachdem Knochen-Kalle ihn gebrochen hatte, mit Draht aus der Sattelkammer und ruhiger Hand. Es hält bis heute. Stadtrat Kröger bekommt vor langen Sitzungen dasselbe wie die Pferde im dritten Rennen und hat seither keine einzige verschlafen.',
    'Vier Totenscheine für Veras Männer tragen ihre Unterschrift, viermal „natürliche Ursache“. Beim ersten stimmte es. Bei den anderen fand sie nichts: kein Gift, keine Wunde, keinen Grund. Nur die Hände der Toten waren am dritten Tag noch warm. Dafür hat das Formular keine Zeile.'
  ];
  ZU.LORE['boss-toto'] = [
    'Graf Toto besitzt einen Rennstall, einen Stammbaum und einen einzigen guten Anzug. Er lebt vom Anschein, und der Anschein lebt gut. Auf Silberhuf gewinnt er jedes knappe Rennen, weil das Zielfoto in seinem eigenen Labor entwickelt wird.',
    'Die Baronin von Hohenstein ist seine Cousine und grüßt ihn nicht. Verlobt ist er mit Fräulein von Zaster: Er will ihr Geld, sie seinen Titel, und beide finden den Handel anständig. Einen Hochzeitstermin gibt es nicht. Jeder wartet darauf, dass der andere zuerst liefert.',
    'Im Keller der Rennbahn rechnet der Totalisator der Spielbank; durch ihn läuft jede Wette der Stadt. Totos bestes Pferd heißt „Hundert zu Eins“, nach einer Quote, die die Maschine eines Nachts ausdruckte, als kein Rennen lief. Der Graf fand den Namen hübsch. Nachgefragt hat er nicht.'
  ];
  ZU.LORE['conductor'] = [
    'Schaffner Knips fährt seit dreißig Jahren auf dem Nachtexpress und ist in der Zeit kein einziges Mal ausgestiegen. Er locht jede Fahrkarte zweimal, zur Sicherheit, und führt über Verspätungen Buch. Das Buch ist leer. Darauf ist er stolz.',
    'Er weiß, wer mit welchem Gepäck einsteigt. Komtess Coupé reist mit sieben Pässen und leeren Koffern, die unterwegs schwerer werden. Knips hat sie nie gemeldet: Ihre Fahrkarte ist jedes Mal echt. Es ist das einzig Echte an ihr, sagt er, und nur dafür ist er zuständig.',
    'Im Gepäckwagen fahren Kisten des Direktors, verplombt, laut Frachtbrief „Papier“. Knips hat nachgewogen: Es ist sehr viel Papier. Nur einen Fahrgast hat er nie kontrolliert, den Herrn im roten Frack im Speisewagen. Er hat es einmal versucht. Die Zange war drei Tage lang warm.'
  ];
  ZU.LORE['countess'] = [
    'Komtess Coupé besitzt sieben Pässe, vier Stammbäume und keinen einzigen echten Titel. Sie reist erster Klasse auf Kosten von Leuten, die es erst am nächsten Morgen bemerken. Den Namen wechselt sie zwischen Suppe und Hauptgang.',
    'Haltung hat sie bei Texas-Theo gelernt: Wer gerade sitzt, dem glaubt man den Rest. Mit dem Lügenbaron war sie drei Tage verheiratet. Jeder hat den anderen betrogen, beide gleich gut. Sie hält es für die ehrlichste Ehe, die sie je geführt hat.',
    'Sie arbeitet nur hier, weil niemand Anzeige erstattet: Wer den Nachtexpress nimmt, bringt sein Geld vor der Spielbank in Sicherheit. Einmal hat sie im Gepäckwagen eine Kiste des Direktors geöffnet. Obenauf lag ein Schuldschein auf den einzigen Namen, den sie nie benutzt: ihren.'
  ];
  ZU.LORE['boss-else'] = [
    'Die Eiserne Else fährt den Nachtexpress, seit ihn sonst keiner mehr fahren wollte. Ihre Lok heißt Brunhilde und bekommt bessere Kohle als die Fahrgäste Kaffee. Der Zug hält erst, wenn jemand Else schlägt. Im Fahrplan steht das unter „Ankunft“.',
    'Heizer Ruß ist ihr Bruder. Er wählte den Ofen, der nie ausgeht, sie den, der einen irgendwohin bringt. Weil er den Regen vermisst, schickt sie ihm Ansichtskarten, auf denen es regnet. Schwefel-Fritz nimmt sie mit nach unten, gegen Trinkgeld. Antwort kam nie. Else schreibt trotzdem.',
    'Else fährt die Reichen samt Geld aus der Stadt und fragt nicht. Sie weiß, was im Gepäckwagen liegt: Kisten voller Schuldscheine, verplombt vom Direktor. Hielte der Zug, könnte jemand nachzählen. Die Kohle zahlt deshalb die Spielbank. Else nennt das Freiheit, aber nur bei voller Fahrt.'
  ];
  ZU.LORE['usher'] = [
    'Ratsdiener Paul trägt seit vierzig Jahren Akten vom Archiv ins Amtszimmer und ungelesen wieder zurück. Seinen Nachnamen kennt niemand; im Stellenplan steht nur „Paul, Bote“. Er weiß von jeder Akte, wo sie liegt, und von den meisten, warum.',
    'Dreimal hat er für Staatssekretärin Dr. Amsel die Akte „Goldener Hahn“ zur Prüfung getragen und dreimal wieder abgeholt. Den Brandfleck am Rand hat er jedes Mal im Laufzettel vermerkt. Daneben liegen Kommissar Falks Berichte, vom Polizeipräsidenten abgeheftet, elf Jahrgänge, ungeöffnet.',
    'Eine Akte gibt er nie heraus: die Konzession für „ein Lokal ganz unten“. Die Tinte ist nach hundert Jahren noch warm; im Winter wärmt Paul sich daran die Hände. Gelesen hat er sie auch. Er weiß, woran ihre Gültigkeit hängt. Sagen würde er es nur jemandem, der in keiner seiner Akten steht.'
  ];
  ZU.LORE['police-chief'] = [
    'Polizeipräsident von Knüppel hält Ordnung für eine Frage des Preises und sich selbst für preiswert. Jede Razzia kündigt er einen Tag vorher an, aus Höflichkeit. Gefunden wird nie etwas. Er wertet das als Erfolg der Vorbeugung.',
    'Als Feldwebel hat er Schrank und Brock das Strammstehen beigebracht; sie stehen bis heute, nur nicht mehr für ihn. Olga brach ihm an der Tür der Roten Laterne die Nase. Er meldete einen Sturz. Argus schrieb ins Protokoll, wie es war, und wurde entlassen. Begründung: Ehrlichkeit im Dienst.',
    'Angekündigt wird jedem Haus, nur der Spielbank nicht: Dort war noch nie eine Razzia. Ein einziges Mal wollte er unangemeldet prüfen, das Lokal ganz unten. Im Ratskeller hieß es, die Konzession sei gültig. Von wann, hat er nicht gefragt. Seine Mütze roch danach wochenlang nach Rauch.'
  ];
  ZU.LORE['boss-mayor'] = [
    'Oberbürgermeister Biedermann ist nach eigener Auskunft nur ein einfacher Bürger, der zufällig die Amtskette trägt. Er lässt jeden herein, hört jedem zu und redet dann selbst, bis keiner mehr weiß, was er wollte. Das Amt ist seit hundert Jahren in der Familie.',
    'Er unterschreibt, was Stadtrat Kröger ihm hinlegt, ohne die Brille aufzusetzen: die Räumung des Lunaparks, den Verkauf des Platzes an die Spielbank. Den halben Ratskeller bezahlt ohnehin das Wohltätigkeits-Bingo von Mutter Immaculata. Biedermann nennt das Bürgersinn.',
    'Sein Urgroßvater hat einem Herrn im roten Frack die Konzession für „ein Lokal ganz unten“ erteilt, mit Brief und Siegel. Seither bleibt das Amt in der Familie. Biedermann hat die Akte nie gelesen. Er hat nur gelernt, bei Brandgeruch das Fenster zu öffnen und über das Wetter zu reden.'
  ];
  ZU.LORE['coat-check'] = [
    'Trude nimmt im Rialto seit dreißig Jahren die Mäntel entgegen, im alten Haus wie im neuen, und wiegt jeden kurz in der Hand. Danach weiß sie, was in den Taschen steckt und ob der Besitzer es am Ende des Abends noch haben wird. Was liegen bleibt, hebt sie auf. Alles.',
    'Mimi bekommt von ihr heißen Tee, Pflaster für die Füße und ungefragt Ratschläge. Die Schachteln ohne Absender, die Mimi jede Woche bekommt und nie raucht, liegen in Trudes hinterstem Fach, nach Datum sortiert. Trude kennt die Schleife. Sie findet, manche Post soll ruhig weiter ankommen.',
    'Als das alte Rialto brannte, trug Trude erst die Mäntel hinaus und dann sich selbst. Einer wurde nie abgeholt. In der Tasche steckt ein Briefchen Streichhölzer aus Lolas Bauchladen; zwei fehlen. Die Marke dazu hat noch niemand vorgezeigt. Wer es täte, hätte gleich zwei Dinge zugegeben.'
  ];
  ZU.LORE['gigolo'] = [
    'Der Schöne Egon tanzt im Rialto mit Witwen, die es sich leisten können, und nennt jede bezaubernd. Die Pomade reicht für zwei, das Knie nur noch für langsame Walzer. Er führt ein Notizbuch mit Geburtstagen, Lieblingsblumen und Kontoständen.',
    'Er schuldet dem Impresario drei Jahresgagen Vorschuss und tanzt sie ab, Abend für Abend. Die Witwen bezahlen Egon, Egon bezahlt den Impresario, der Impresario bezahlt die Spielbank. Egon findet, dafür, dass am Ende die Spielbank kassiert, lächle er entschieden zu viel.',
    'Er ist der Einzige, der Vera lebend verlassen hat: Er hat sie nie geheiratet. Dreimal hat sie gefragt. Aber einmal im Jahr sah er sie mit einem Herrn im roten Frack tanzen, und der Herr führte. Egon erkennt am Schritt, wenn jemand Zinsen eintreibt. Er blieb lieber beim Walzer.'
  ];
  ZU.LORE['dancer'] = [
    'Kitty Kirsch tanzt in der Roten Laterne und wirft Kusshände, nach denen die Gäste zwei Runden lang nicht wissen, wo ihre Karten sind. Die Stimme ist süß, die Ellbogen sind es nicht. Im Pass steht Käthe Kirschbaum. Den Pass zeigt sie keinem.',
    'Gigi hat sie unter ihre Fittiche genommen und ihr als Erstes die Apfelschorle gezeigt. Jede Mark Trinkgeld wandert in eine Mehldose: Kitty spart auf die Bäckerei von Oma Hedwig. Sie kauft dort jeden Morgen zwei Brötchen und zählt dabei heimlich die Kacheln.',
    'Ihr Vertrag stammt vom Consigliere. Paragraf sieben regelt, was sie dem Haus schuldet, falls sie geht: ziemlich genau den Preis einer Bäckerei, jedes Jahr etwas mehr. Kitty hat es nachgerechnet, auf einer Mehltüte. Sie spart trotzdem weiter. Papier, sagt Olga, hält auch nicht ewig.'
  ];
  ZU.LORE['photographer'] = [
    'Blitzlicht-Benno fotografiert die Gäste der Roten Laterne, am liebsten, wenn sie es nicht merken. Er schwitzt, trägt Fliege und nennt sich Gesellschaftsfotograf. Einen Abzug bekommt man bei ihm für fünf Mark. Kein Abzug kostet fünfzig.',
    'Die Negative gehen an den Verleger, der damit keine Zeitung füllt, sondern Schubladen. Stadtrat Kröger ist auf elf Platten zu sehen, der Polizeipräsident auf vierzehn. Benno hält das für seine Altersvorsorge. Olga hält es für einen Grund, ihn im Auge zu behalten.',
    'Ein Bild hat er nie abgeliefert. Es zeigt den hintersten Tisch: ein Gast, gestochen scharf, den Füllhalter in der Hand. Gegenüber saß ein Herr im roten Frack. Auf dem Abzug steht dort ein leerer Stuhl. Benno hat dreimal neu abgezogen. Das Papier kommt jedes Mal warm aus dem Bad.'
  ];
  ZU.LORE['cook'] = [
    'Kombüsen-Kuddel kocht auf der Fortuna ein einziges Gericht: Labskaus, morgens, mittags, nachts. Er wirft Salz über die linke Schulter, klopft auf Holz und pfeift nie an Bord. Wer um die Speisekarte bittet, bekommt eine zweite Kelle.',
    'Kelle und Kombüse hat er von Bruno übernommen, damals auf dem Frachter, und ist später mit Matrose Hein auf die Fortuna gewechselt. Das Rezept ist Brunos. Einmal im Jahr schickt Kuddel eine Dose Labskaus an die Bar des Goldenen Hahn. Zurück kommt ein Bierdeckel: „Weniger Salz.“',
    'Zahlmeister Pfennig lässt sich die Suppe in die Kajüte bringen. Steht der Teller morgens voll und kalt vor der Tür, war er nachts an Land rudern. Kuddel macht dafür Kreidestriche an die Kombüsenwand. Jeden Sonntag kommt die Erste Offizierin auf einen Nachschlag und zählt mit.'
  ];
  ZU.LORE['first-mate'] = [
    'Erste Offizierin Sturm hat auf der Fortuna die Wache, die Schlüssel und selten gute Laune. An ihr prallt ab, was andere umwirft. Die Kapitänin überlässt ihr das Schiff, sobald sie schläft, also ungefähr zweimal im Jahr.',
    'Sie ist die Tochter des Impresario. In der Nacht, in der er die Fortuna an eine einäugige Frau verspielte, stand sie hinter seinem Stuhl und sah sein unschlagbares Blatt. Am Morgen heuerte sie bei der Gewinnerin an. Er nennt das Schiff ein Geschenk. Die Tochter erwähnt er nicht.',
    'Das dritte Buch der Fortuna führt sie, in sauberer Schrift, während der Wache. Darin steht jede Nacht, in der Zahlmeister Pfennig an Land rudert, jeder Sack und jeder Schuldschein, den er für den Direktor aufkauft. Die Kapitänin will warten, bis der Köder sich lohnt. Sturm wartet ungern.'
  ];
  ZU.LORE['sprayer'] = [
    'Dose heißt so, weil sie nie ohne eine aus dem Haus geht. Sie redet kaum und unterschreibt lieber: an Mauern, Brücken, Lieferwagen. Jedes Casino der Stadt trägt ihr Zeichen. Im Imperial hat man es dreimal überstrichen und beim vierten Mal einen Rahmen darum gehängt.',
    'Sie malt die Cover für Lil Zünd, auch das für das zweite Album, das es offiziell nicht gibt. Milan hat ihr die Spuren vorgespielt, Fräulein von Zaster die Farbe bezahlt. Papa Platin hält das Bild an der Studiowand für eine Schmiererei. Es hängt genau über seinem Schreibtisch.',
    'Auch die Tür des Inferno hat sie getaggt. Am Morgen war das Zeichen weg und die Tür warm. In ihrer Jacke steckte eine Karte, rot, ohne Namen: „Wir stellen auch Künstler ein.“ Dose warf die Jacke in den Kanal. Am Abend steckte die Karte in der neuen.'
  ];
  ZU.LORE['dj'] = [
    'DJane Nova legt im Block 9 auf und zählt dabei alles mit: Takte, Gäste, deine Fehler. Sie nimmt die Kopfhörer nie ab und redet in BPM. Wer sie von links anspricht, bekommt keine Antwort. Das ist keine Arroganz, jedenfalls nicht nur.',
    'Ihre bekannteste Nummer ist eine Schleife aus vier Takten, die nie auflöst. Sie hat sie von Milan und hält sie für seine beste Idee. Dass die Melodie von einem alten Pianisten im Goldenen Hahn stammt, hat er ihr nie gesagt. Sie hat auch nie gefragt, warum sie kein Ende hat.',
    'Einmal hat sie im Inferno aufgelegt. Als die Schleife lief, stand eine Sängerin auf und sang mit, bis zu der Stelle, an der es abbricht. Dann war es still. Seit dieser Stille ist Nova links taub. Die Gage war fürstlich. Wessen Lied das ist, weiß sie nicht. Sie spielt es jede Nacht.'
  ];
  ZU.LORE['maid'] = [
    'Zimmermädchen Fanny macht im Imperial vierzig Betten am Tag und liest dabei vierzig Papierkörbe. Was die Gäste wegwerfen, verrät mehr als das, was sie an der Rezeption angeben. Fanny wischt jeden Fleck weg. Was sie weiß, wischt sie nicht weg.',
    'Für Fanny ist Page Anton der kleine Bruder, den sie nie bestellt hat: Sie bügelt ihm die Uniform, deckt seine Abwesenheiten und zieht ihm die Ohren lang, wenn er sechzehn sagt. Dass er Lil Zünd in die Hotelbar schmuggelt, weiß sie. Die Limonade für beide schreibt sie auf Zimmer zwölf.',
    'In Laurents Papierkorb lagen Zahlscheine: die Raten der Hypothek, an die Spielbank, von seinem Konto. Fanny hat sie geglättet und schweigt. Im Korb der Baronin liegt jeden Morgen dasselbe geknickte Ass: Die alte Dame übt nachts Kartentricks. So, denkt Fanny, verliert man also kein Hotel.'
  ];
  ZU.LORE['detective'] = [
    'Hoteldetektiv Argus sitzt im Trenchcoat in der Lobby des Imperial, hinter einer Zeitung von vorgestern. Er sieht jeden, der kommt, und kennt dein Blatt, bevor du es hebst. Er war einmal Polizist. Müde ist er seit damals.',
    'Polizeipräsident von Knüppel hat ihn entlassen, weil er Protokolle so schrieb, wie es war. Mit Kommissar Falk fuhr er früher Streife. Falk ermittelt noch immer und schickt ihm von jedem Bericht einen Durchschlag. Argus ist der einzige Mensch in der Stadt, der sie liest.',
    'Den Collier-Fall hat er vor Jahren gelöst: Sally war es, Anton hielt die Tür, die Steine hängen an Dolores. In seinem Bericht steht „Täter unbekannt“. Manfred hat ihn darum gebeten, das einzige Mal. Wenn das Haus brennt, sagte er, wolle er einen ehrlichen Mann in der Nähe wissen.'
  ];
  ZU.LORE['slot-tech'] = [
    'Groschen-Gerd wartet die Automaten der Spielbank Monopol, vierhundert Stück, jeder mit eigenem Namen. Er riecht nach Schmieröl und hört am Rattern, welcher bald auszahlt. Dann holt er den Schraubenzieher.',
    'Mittags sitzt er mit Klara auf der Laderampe. Sie teilen ein Butterbrot und ein Wissen: Im Haus läuft nichts rund, was rund aussieht. Klara lässt die Kugel manchmal fallen, wie sie will. Gerd zieht bei Automat sieben die Schraube nicht ganz an. Der Direktor verbucht beides als Schwund.',
    'Die Anweisung kommt jedes Jahr schriftlich: drei Prozent knapper. Was die Gäste verlieren, leiht ihnen die Kasse gegenüber, gegen Unterschrift. Gerd wartet also eine Druckerei für Schuldscheine. Sein ehrlicher Automat steht fertig im Lager, unter einer Decke. Im Saal würde er auffallen.'
  ];
  ZU.LORE['pit-boss'] = [
    'Madame Zéro führt den großen Saal der Spielbank Monopol. Sie spricht leise, mit französischem Tonfall, und sieht von ihrem Platz aus jeden Tisch, jede Hand und jeden Ärmel. Von dem, was du mitbringst, behält sie die Hälfte ein. Sie nennt das den Empfang.',
    'Emil hat Klara das Geben beigebracht, Madame Zéro das Stillhalten: zwei Jahre lang jeden Morgen eine volle Tasse auf dem Handrücken. Seitdem zittert bei Klara nichts mehr. Madame ist darauf so stolz, wie sie es sich erlaubt. Es reicht für ein Nicken im Jahr.',
    'Sie weiß, dass Klara die Kugel manchmal fallen lässt, wie sie will. Sie hat es jedes Mal notiert, mit Datum, und nichts gemeldet. Im Tresor liegt auch ein Schein auf ihren eigenen Namen. Sollte der Direktor ihn je einlösen wollen, hat sie etwas zum Tauschen. Noch braucht sie es nicht.'
  ];
  ZU.LORE['imp'] = [
    'Schwefel-Fritz ist Laufbursche im Inferno und der bestgelaunte Mensch dort unten. Er hat für „eine Stelle mit Aussichten“ unterschrieben und ist seit dreihundert Jahren in der Lehre. Die Aussicht, sagt er, sei wirklich bemerkenswert. Man müsse nur nach oben schauen.',
    'Er trägt die roten Umschläge aus. Den für Papa Platin hat er persönlich ins Studio gelegt und dabei einen Takt lang mitgewippt. Auf dem Rückweg nimmt er Post nach unten mit: Ansichtskarten der Eisernen Else für Heizer Ruß. Es regnet auf jeder. Ruß bewahrt sie weit weg vom Ofen auf.',
    'Seit Kurzem trägt er Umschläge aus, deren Namenszeile leer ist. Sie gehen alle an dich. Sonst füllt der Fürst die Zeile selbst aus; bei dir, sagt er, wolle er höflich sein und warten. Fritz kennt diese Höflichkeit. Mit ihr fing seine Lehre an. Er wünscht dir Glück, aber nicht zu laut.'
  ];
  ZU.LORE['notary'] = [
    'Notarin Tinte hat jeden Vertrag des Fürsten aufgesetzt, mit dem Federkiel, in einer Tinte, die nicht abkühlt. Ihre Finger sind schwarz bis zum zweiten Glied. Leute, die unterschreiben, findet sie interessant. Leute, die es nicht tun, findet sie unerträglich.',
    'Drei Akten rauben ihr den Schlaf. Der Große Bellini hat seinen Vertrag verschwinden lassen, sie sucht ihn noch. Hinz und Kunz unterschreiben jeweils mit dem Namen des anderen, also gilt keiner. Die dritte Akte ist leer. Nicht einmal ein Name steht darauf. Sie liegt trotzdem ganz oben.',
    'In jedem Vertrag steht ganz unten eine Klausel, die außer ihr niemand liest: womit das Papier brennt und womit nicht. Sie hielt das für Formsache, solange die Schachtel auf dem Schreibtisch des Fürsten lag. Dort ist jetzt ein heller Fleck. Tinte spitzt seitdem die Feder zweimal am Tag.'
  ];
  ZU.LORE['dice-girl'] = [
    'Würfel-Wanda pustet auf alles: Würfel, Karten, fremde Einsätze, heißen Kaffee. Sie kaut Erdbeerkaugummi, redet beim Mischen und hält Lautstärke für eine Strategie. Widerlegt hat sie bisher niemand, jedenfalls nicht hörbar.',
    'Sie ist die Tochter von Direktor Zampano und zwischen gezinkten Buden groß geworden. Dann lief sie fort, zu „richtigen Casinos“. Ihr Vater schickt ihr zu jeder Saison eine Freikarte fürs Riesenrad. Wanda hat keine eingelöst und keine weggeworfen.',
    'Was Wanda gewinnt, geht an Donna Scarlatta: der Teil vom Schutzgeld, den der Lunapark nicht mehr einspielt. Zampano wundert sich, dass Donna nie mahnt. Wanda weiß auch, dass die Stadt den Platz längst der Spielbank versprochen hat. Seitdem pustet sie fester.'
  ];
  ZU.LORE['granny'] = [
    'Oma Hedwig strickt beim Spielen, lutscht Hustenbonbons und kennt keine Gnade. Hält sie nur noch eine Karte, ruft sie „Bingo!“, und du ziehst zwei. Sie hat drei Casinos überlebt. Zwei davon stehen nicht mehr, das dritte grüßt sie zuerst.',
    'Knochen-Kalle ist ihr Enkel; er fürchtet den Schieber ein wenig und sie sehr. Ihr gehört außerdem die Bäckerei, auf die Kitty Kirsch spart. Hedwig kennt den Preis längst. Sie will erst sehen, ob das Mädchen um vier Uhr früh aufstehen kann.',
    'Hedwig strickt seit Jahren am selben Schal. Jede Reihe ist eine Zahl aus dem Wohltätigkeits-Bingo der Mutter Immaculata. Der Schal beweist zweierlei: Die Trommel ist gezinkt, und der Gewinn landet im Ratskeller. Hedwig wartet nur noch auf den passenden Winter.'
  ];
  ZU.LORE['scrap-dealer'] = [
    'Eisen-Ede kauft, was abbrennt. Am Morgen danach kommt er mit dem Handkarren, wiegt die Reste und zahlt bar, in kleinen Scheinen. Seit du in der Stadt bist, zieht er dir von Haus zu Haus nach. Er nennt das Kundenpflege.',
    'Was sich noch verkaufen lässt, bekommt Auktionator Hammer. Was nur noch Asche ist, geht an Donna Scarlatta. Ede hat nie gefragt, wozu eine Dame Asche braucht, nur, ob sie nach Gewicht zahlt. Sie zahlt nach Herkunft.',
    'Die Liste der Häuser hat Ede von seinem Vater, und der von seinem. Ganz oben steht seit hundert Jahren der Goldene Hahn, nie durchgestrichen. Daneben, in fremder Handschrift: „Abholung durch den Eigentümer.“ Ede hat den Karren trotzdem geölt.'
  ];
  ZU.LORE['tourist'] = [
    'Herr Schmidt trägt Bauchtasche und Kamera und fragt mitten im Spiel, ob die Sieben etwas Besonderes sei. Dann legt er sie. Er gewinnt aus Versehen und entschuldigt sich so aufrichtig dafür, dass es gleich doppelt wehtut.',
    'Vor drei Jahren hat er seine Reisegruppe verloren und ist geblieben. Concierge Laurent verlängert sein Zimmer im Imperial Woche um Woche. Jeden Abend fährt ihn Droschken-Paule zum Bahnhof, und jeden Abend fährt der Nachtexpress durch. Schmidt winkt und macht ein Foto.',
    'Die Reisegruppe hat ihn nicht verloren. Sie hat am ersten Abend geschlossen unterschrieben: eine Rundfahrt „ganz nach unten, alles inklusive“, roter Umschlag, warme Tinte. Schmidt stand gerade nach Postkarten an. Er sucht den Bus bis heute.'
  ];
  ZU.LORE['newsboy'] = [
    'Piet ruft Schlagzeilen aus, die noch keiner gedruckt hat, am liebsten über dich. Die Zeitung von morgen verkauft er schon heute, zum doppelten Preis. Beschwert hat sich noch niemand: Was drinsteht, gilt morgen ja als wahr.',
    'Page Anton und Lil Zünd sind seine besten Freunde. Anton liefert, was im Imperial geflüstert wird, Lil Zünd reimt die Überschriften. Sein Brotherr ist der Verleger. Der zahlt einen Pfennig pro Blatt und zieht zwei ab, wenn Piet es selbst liest.',
    'In der Setzerei hat Piet eine Schlagzeile gesehen, die fertig im Regal liegt und auf ihren Morgen wartet: „Kein Brand im Goldenen Hahn“. Er hat niemandem davon erzählt. Er fragt sich nur, woher einer so früh weiß, was er einmal leugnen muss.'
  ];
  ZU.LORE['chimney-sweep'] = [
    'Felix Glück heißt wirklich so. Jeder will an seinen Knopf fassen, also näht er jeden Montag einen neuen an und nimmt zehn Pfennig fürs Drehen. Flüche perlen an ihm ab wie Regen am Zylinder. Er hält das für Berufskleidung.',
    'Auf der Fortuna hat er jahrelang gegen Heizer Ruß gearbeitet: Der eine machte den Schlot schwarz, der andere wieder sauber. Seit Ruß fort ist, fehlt ihm der Gegner. Die Kapitänin sagt nur, er heize jetzt woanders. Felix hat gefragt, wer dort kehrt.',
    'Zwei Schornsteine stimmen nicht. Der des Goldenen Hahn hatte in hundert Jahren nie Ruß; so steht es im Kehrbuch, schon bei seinem Meister. Der des Inferno hat oben kein Ende: Felix ist einmal eingestiegen und kehrte um, als es mit jedem Meter wärmer wurde.'
  ];
  ZU.LORE['magician'] = [
    'Der Große Bellini trägt einen Frack, der einmal schwarz war, und einen Zylinder mit Kaninchen. Er heißt Bernd. Nach jedem fünften Zug lässt er eine Karte verschwinden und verbeugt sich. Wohin die Karten gehen, weiß nur das Kaninchen.',
    'Früher hieß die Nummer „Bellini & Esmeralda“: Er ließ Tauben fliegen, sie las dem Saal die Zukunft. Dann verließ ihn Esme für echte Karten. Bellini schickt ihr zu jeder Premiere Freikarten. Manfred nimmt die Post an und legt sie sehr weit nach unten.',
    'Ein einziger Trick von ihm ist echt, und er führt ihn nie vor: Er hat einen Vertrag in warmer Tinte unterschrieben und ihn dann verschwinden lassen. Notarin Tinte sucht das Papier bis heute. Bellini sagt, er wisse von nichts. Sein Zylinder ist innen warm.'
  ];
  ZU.LORE['crypto-bro'] = [
    'Kai Krypto trägt Daunenweste, auch im Sommer. Alles ist eine Riesenchance, vor allem das, was er gerade verkauft. Er nennt jeden „Bro“, auch die Baronin von Hohenstein. Sie hat nicht reagiert, und Kai wertet das als Interesse.',
    'Quoten-Otto hat er eine Münze verkauft, die nach Otto benannt ist. Otto hält den Ottocoin für seine erste sichere Bank. Nebenbei verwaltet Kai das Sponsorengeld von Lucky Luis; Luis hat nie gefragt, worin es angelegt ist. Es ist der Ottocoin.',
    'Einmal hat Kai dem Herrn im roten Frack ein Geschäft vorgeschlagen: alle Verträge als Token, frei handelbar, jede Seele ein Kurs. Der Herr hörte höflich zu und fragte nur, was Kai als Sicherheit biete. Seitdem friert Kai. Daher die Weste.'
  ];
  ZU.LORE['nurse'] = [
    'Nachtschwester Agnes spielt nach zwölf Stunden Schicht, um nicht einzuschlafen. Sie hat das halbe Milieu genäht und verrät keinen einzigen Stich. Nur lügen kann sie schlecht: Sie summt dabei. Wer das weiß, gewinnt trotzdem nicht öfter.',
    'Als Dr. Spritze Brunos Kiefer flickte, hielt Agnes die Nachtwache. Drei Nächte saß Knochen-Kalle auf dem Besucherstuhl und weinte in seine Mütze. Agnes brachte ihm Tee und verlor nie ein Wort darüber. Kalle grüßt sie seitdem als Erster und sehr leise.',
    'Den Sohn der Baronin hat sie in seinem letzten Jahr gepflegt. Er war krank, schon vor der Hochzeit, und er wusste es: kein Fluch, nur ein schwaches Herz. Vera hält es bis heute für ihren geliehenen Fluch, die Baronin für Veras Schuld. Agnes hat nie jemand gefragt.'
  ];
  ZU.LORE['taxi'] = [
    'Droschken-Paule fährt alle überallhin und kennt zu jedem Ziel einen Umweg. Sein Taxameter tickt auch am Kartentisch: Nach jedem sechsten Zug wird etwas fällig. Vor jedem Haus, das du betrittst, steht sein Wagen schon da. Der Motor läuft.',
    'Im Rückspiegel hört Paule alles: Stadtrat Kröger, der Summen flüstert, Vera, die Beileid übt, und einmal die Woche Manfred, der zur Hintertür des Hahn will, weil er dort etwas vergessen hat. Paule merkt sich jedes Wort und vergisst jede Adresse.',
    'Einmal stieg ein Herr im roten Frack ein und sagte nur: „Nach unten.“ Die Straße kannte Paule nicht, der Wagen schon, und das Taxameter lief die ganze Fahrt rückwärts. Der Herr zahlte nichts und sagte höflich, den Rest regle man bei Gelegenheit. Paule lässt die Uhr seitdem immer laufen.'
  ];
  ZU.LORE['commissar'] = [
    'Kommissar Falk ermittelt seit elf Jahren verdeckt am Spieltisch. Jeder Croupier der Stadt grüßt ihn mit Dienstgrad. Er trägt einen falschen Bart über dem echten und ruft im Eifer „Razzia!“, worauf niemand aufsteht. Falk hält das für gute Tarnung.',
    'Sein alter Partner Argus ist heute Hoteldetektiv im Imperial. Die beiden teilten ein Büro, eine Thermoskanne und die Ansicht, dass man Berichte ehrlich schreibt. Argus wurde dafür entlassen. Falk schreibt weiter, an Polizeipräsident von Knüppel, der alles ungelesen abheftet.',
    'Elf Jahre Berichte ergeben eine Akte: „Stadt gegen Unbekannt (roter Frack)“. Darin stehen ein Haus mit hundert Jahren Glück und ein Verdächtiger ohne Meldeadresse. Für die Anklage fehlt Falk nur noch ein Zeuge, der dem Mann nichts schuldet. Er sucht seit elf Jahren.'
  ];
  ZU.LORE['twins'] = [
    'Hinz & Kunz beenden die Sätze des anderen und spielen die Karten des anderen. Wer von beiden wer ist, weiß niemand, sie selbst auch nicht: Die Namensbändchen gingen am ersten Tag verloren. Sie tragen es mit Fassung. Mit einer, zu zweit.',
    'Bei Quoten-Otto wetten sie grundsätzlich gegeneinander. Einer gewinnt immer, und Otto zahlt aus, ohne zu wissen, an wen. Schrank lässt an der Tür des Hahn nur einen von beiden herein; drinnen sitzen trotzdem zwei. Schrank denkt darüber nicht nach.',
    'Unterschrieben haben sie alles, was man ihnen vorlegte, auch zweimal in warmer Tinte – stets mit dem Namen des anderen. Kein Vertrag gilt. Notarin Tinte schläft schlecht. Der Fürst bleibt gelassen: Er wartet, bis einer von beiden herausfindet, wer er ist.'
  ];
  ZU.LORE['hypnotist'] = [
    'Morpheo lässt eine Taschenuhr pendeln und sagt: „Sie werden müde.“ Meistens stimmt es. Hypnotisieren kann er allerdings nur, wer etwas vergessen will. In dieser Stadt hatte er deshalb noch keinen einzigen freien Abend.',
    'Kessler hat ihn bezahlt, damit er ihm jede Regung nimmt: kein Zucken, kein Blinzeln, kein Tell. Morpheo hat gründlich gearbeitet, seither kann Kessler nicht mehr lächeln. Morpheo bot an, es rückgängig zu machen. Kessler verzog keine Miene.',
    'Die Sirene hat ihren Trick von ihm: Wer zuhört, vergisst. Bevor sie nach unten ging, bat sie ihn, ihr einen Pianisten aus dem Kopf zu nehmen. Die Uhr pendelte eine Stunde, vergeblich: Sie wollte nicht vergessen. Ihren Namen hat sie dann woanders gelassen.'
  ];
  ZU.LORE['heiress'] = [
    'Fräulein von Zaster hat alles und langweilt sich entsprechend. Sie spielt mit vier Spezialkarten und einem Schoßhund namens Dividende und verliert mit so viel Stil, dass sich der Sieger schäbig vorkommt. Wer sie schlägt, bekommt mehr. Sie nennt es Taschengeld.',
    'Sie ist mit Graf Toto verlobt. Er will ihr Geld, sie seinen Titel, und beide halten sich für den besseren Kaufmann. Die Ringe hat sie bezahlt. Auf sein bestes Pferd, „Hundert zu Eins“, setzt sie nie: Man wettet nicht auf etwas, das einem bald gehört.',
    'Ihr Vater, der Verleger, bestimmt, was die Stadt liest. Aus Trotz bezahlt sie, was er nicht drucken kann: das heimliche Album, das Milan nachts für Lil Zünd aufnimmt. Hineingehört hat sie nie. Im selben Studio liegen acht Takte, auf die ganz unten jemand wartet.'
  ];
  ZU.LORE['chess-master'] = [
    'Großmeister Rochus denkt zwölf Züge voraus und verachtet jeden, der es nicht tut. Karten spielt er nur, um zu beweisen, dass es Glück nicht gibt. Eine Niederlage heißt bei ihm „Unregelmäßigkeit beim Mischen“. Vor dir hat er das Wort zweimal gebraucht.',
    'Verloren hat er gegen Dr. Zahl, der ihn ausrechnete, und gegen Kessler, der mit einem leeren Blatt nicht einmal blinzelte. Die Rechnung hat Rochus verziehen. Den Bluff nennt er Betrug mit dem Gesicht – begangen von einem Mann, der seines nie benutzt.',
    'Eine Stellung bekommt Rochus nicht gelöst: die Serie des Hausherrn. Hundert Jahre ohne Niederlage sind weder Können noch Zufall. Er hat die Partie Zug um Zug zurückverfolgt, bis zu einer Unterschrift. Seitdem weiß er: Glück gibt es doch, man gewinnt es nur nicht – man leiht es.'
  ];
  ZU.LORE['auctioneer'] = [
    'Auktionator Hammer redet schneller, als andere denken, und schlägt zu, bevor sie fertig sind. An seinem Tisch kommt die Sperrstunde früher: Wer zögert, hat geboten. Einmal hat er versehentlich seinen eigenen Hut versteigert und ihn mit Aufgeld zurückgekauft.',
    'Am Morgen nach jedem Brand steht er in der Asche und versteigert das Inventar, im Auftrag von Donna Scarlatta. Eisen-Ede karrt die Stücke an, Hammer nennt sie „Raritäten mit Geschichte“. Donna bekommt den Erlös, Ede den Kilopreis, Hammer das letzte Wort.',
    'Den Flügel des Goldenen Hahn hat er schon dreimal verkauft, obwohl Fingers jeden Abend daran sitzt: an Donna, an die Spielbank und auf ein schriftliches Gebot hin, das nicht in Mark lautete. Die Tinte war noch warm. Hammer hofft, dass der dritte Käufer nie erscheint.'
  ];
  ZU.LORE['boss-baron'] = [
    'Der Lügenbaron trägt ein Monokel aus Fensterglas und Orden von Armeen, die es nie gab. Auf einer Kanonenkugel ist er geritten, sagt er, zweimal. Seine Asse und Buben passen auf jede Karte, weil er es behauptet und noch niemand die Geduld hatte, zu widersprechen.',
    'Drei Tage war er mit Komtess Coupé verheiratet. Er heiratete ihr Vermögen, sie seinen Titel, und es gab weder das eine noch das andere. Am vierten Morgen fehlten ihm die Orden und ihr die Perlen; beides war falsch. Beide sprechen von der großen Liebe.',
    'Eine Geschichte erzählt er nie, und sie ist als einzige wahr: Er saß am Tisch des Herrn im roten Frack und redete, die ganze Nacht. Am Morgen fand der Vertrag keinen wahren Namen, auf den er lauten konnte. Der Baron weiß seinen selbst nicht mehr. Er findet den Preis günstig.'
  ];
  ZU.LORE['boss-abbess'] = [
    'Mutter Immaculata spricht so sanft, dass man ihr Lineal aus Stahl erst bemerkt, wenn es aufschlägt. Wer sich an ihren Tisch setzt, hat schon gesündigt und büßt in Karten. Ihr Orden lebt in Armut. Das Gelübde, betont sie, gilt für die Schwestern, nicht für die Kasse.',
    'Ihr Wohltätigkeits-Bingo füllt jede Woche den Gemeindesaal. Oma Hedwig sitzt in der ersten Reihe, gewinnt öfter, als die Trommel vorsieht, und ist damit beste Kundin und ärgste Feindin zugleich. Immaculata betet für sie. Hedwig sagt, man merke es an den Zahlen.',
    'Der Erlös des Bingos geht nicht an die Armen, sondern in den Ratskeller; der halbe Stadtrat stimmt, wie ihre Kollekte klingelt. Den Herrn im roten Frack fürchtet sie nicht. Sie hält ihn für Konkurrenz und unterbietet ihn: Er holt alles am Ende, sie nimmt Raten.'
  ];
  ZU.LORE['boss-judge'] = [
    'Richter Gnadenlos trägt die Robe auch am Kartentisch und den Hammer in der Innentasche. Nach jedem dritten Zug ergeht ein Urteil, und es trifft immer dich. Berufung ist zulässig. Sie wird von ihm selbst verhandelt und endet wie die erste Instanz.',
    'Jedes seiner Urteile hat einen Preis, und die Preisliste führt der Consigliere. Den Schieber hat er elfmal freigesprochen, stets aus Mangel an Beweisen; die Beweise lagen jedes Mal im Nebenzimmer. Für das zwölfte Mal hat der Schieber um Mengenrabatt gebeten.',
    'Eine Akte ruft er nie auf: „Stadt gegen Unbekannt (roter Frack)“. Kommissar Falk füllt sie seit elf Jahren, Gnadenlos lässt sie liegen. Er weiß, was geschähe: Der Beklagte käme pünktlich und fragte als Erstes, wer im Saal schon bei ihm unterschrieben hat.'
  ];
  ZU.LORE['boss-publisher'] = [
    'Dem Verleger gehört die einzige Zeitung der Stadt und damit der gestrige Tag. Was er nicht druckt, ist nicht geschehen; was er druckt, geschieht noch. Deine Hand kennt er, weil er sie für die Morgenausgabe bereits beschrieben hat.',
    'Fräulein von Zaster ist seine Tochter, Piet sein Zeitungsjunge und Blitzlicht-Benno sein Lieferant: Die Negative aus der Roten Laterne liegen in seinem Schrank, nach Ämtern sortiert. Gedruckt hat er nie eines. Ein Bild, sagt er, ist am meisten wert, solange es jeder fürchtet.',
    'Für den Morgen nach dem Brand hat er die Schlagzeile längst gesetzt: „Kein Brand im Goldenen Hahn“. Einen Vertrag mit dem Herrn im roten Frack brauchte er nie. Seine Seele hat er selbst gedruckt, in Fortsetzungen, zehn Pfennig das Stück. Der Herr hat ein Abonnement.'
  ];
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
