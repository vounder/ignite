/* Zündung – die Geschichte „Hundert Jahre Glück": alle Szenen als reine Daten. Abgespielt von js/cutscene.js.

   Eine Szene ist eine Liste von Schritten:
     ['card', 'Kopfzeile', 'Titel']          Texttafel (Kapitel)
     ['bg', 'story/hahn-a']                  Kulisse (assets/<pfad>.png), blendet über
     ['in', 'manfred', 'l' | 'r', 'shade']   Figur tritt links oder rechts auf (ersetzt, wer dort steht); 'shade': nur als Schatten
     ['out', 'manfred']                      Figur geht ab
     ['n', 'Text']                           Erzähler (zweite Person: Du bleibst stumm)
     ['<figur>', 'Text', 'stimmung']         Figur spricht. Stimmung der Gegner: idle, smug, angry, shocked, defeated;
                                             Manfred: grin, annoyed, surprised, hat, coin, match, cards, side, wink; Esme: greedy, annoyed, surprised, dreamy
     ['fx', 'flash' | 'shake' | 'embers']    Effekt
     ['news', 'SCHLAGZEILE', 'Unterzeile']   Zeitung
   Figuren: 'manfred', 'esme' oder die Kennung eines Gegners (ZU.ENEMIES). names: abweichender Name in dieser Szene.

   Vertonung: Jede gesprochene oder erzählte Zeile (n, Figur, news) hat die Kennung <szene>-<laufende Nummer>, z. B.
   „hahn-ende-07". web/tools/story_lines.js schreibt daraus die Liste für die Sprachaufnahmen; liegt zu einer Zeile eine
   Aufnahme vor (js/voice-manifest.js), spielt das Spiel sie ab. Wer Zeilen einfügt oder streicht, verschiebt die
   Nummern dahinter – die Aufnahmen tragen deshalb den Fingerabdruck ihres Textes und verstummen, wenn er nicht mehr passt. */
(function (ZU) {
  'use strict';

  var S = {};
  function scene(id, title, def) { def.id = id; def.title = title; S[id] = def; }

  /* ---------- Prolog ---------- */
  scene('prolog', 'Die Schachtel', { bg: 'title/alley', steps: [
    ['card', 'Prolog', 'Die Schachtel'],
    ['n', 'Es regnet. Du bist neu in der Stadt, und die Stadt hat es noch nicht bemerkt.'],
    ['n', 'Hinter dem Goldenen Hahn zählst du, was du hast. Es geht schnell.'],
    ['in', 'manfred', 'r'],
    ['manfred', 'Kundschaft! Um diese Uhrzeit, in dieser Gasse. Entweder du willst etwas kaufen, oder du hast dich verlaufen.', 'hat'],
    ['manfred', 'Manfred. Ich verkaufe alles, was sich tragen lässt. Darf ich fragen: Schuldest du jemandem Geld?'],
    ['n', 'Du schüttelst den Kopf.'],
    ['manfred', 'Einen Vertrag unterschrieben? Einen Deckel offen? Deinen Namen in irgendein Buch gesetzt?', 'side'],
    ['n', 'Nichts davon. Du bist erst gestern angekommen.'],
    ['manfred', 'Niemandem etwas schuldig. In dieser Stadt! Weißt du, wie selten das ist? Ich kenne genau einen. Der steht vor mir.', 'surprised'],
    ['bg', 'story/prolog-box'],
    ['manfred', 'Dann habe ich etwas für dich. Drei Stück. Mehr sind nie drin.', 'match'],
    ['n', 'Eine Schachtel Streichhölzer. Alt. Die Hölzer fühlen sich warm an, obwohl noch keines gebrannt hat.'],
    ['manfred', 'Bei mir zünden sie nicht. Ich schulde der Dame im Nebenzimmer die halbe Miete. Bei dir schon.', 'annoyed'],
    ['manfred', 'Jeder Tisch dieser Stadt steht auf Papier. Schuldscheine. Verträge. Spiel so, dass der Tisch heiß wird – dann brennt, was darunter liegt.'],
    ['manfred', 'Verlierst du, ist ein Holz weg. Sind alle drei weg, ist Feierabend. Morgen ist die Schachtel wieder voll. Frag nicht.', 'wink'],
    ['n', 'Du fragst nicht. Du fragst etwas anderes: was er davon hat.'],
    ['manfred', 'Ich? Ich habe eine Wette laufen. Hundert zu eins. Und jetzt rein mit dir – ich habe drinnen zufällig etwas vergessen.', 'grin']
  ] });

  /* ---------- 1 · Zum Goldenen Hahn ---------- */
  scene('hahn-ankunft', 'Geschlossene Gesellschaft', { bg: 'story/hahn-a', steps: [
    ['card', 'Erstes Haus', 'Zum Goldenen Hahn'],
    ['in', 'bouncer', 'r'],
    ['bouncer', 'Geschlossene Gesellschaft.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Schrank, alter Freund! Ich habe meinen Schirm liegen lassen. Und das hier ist … mein Schirmträger.', 'hat'],
    ['bouncer', '… Du vergisst jede Woche was.', 'angry'],
    ['manfred', 'Ein Elend mit meinem Gedächtnis.', 'wink'],
    ['out', 'bouncer'],
    ['n', 'Drinnen: Rauch, grüner Filz und ein Klavier, das dasselbe Lied in der falschen Tonart spielt.'],
    ['manfred', 'Hinterzimmer, Rauchsalon, und ganz oben der Hausherr. Hundert Jahre am selben Tisch, nie verloren. Die Stadt hält das für eine Redensart.'],
    ['manfred', 'Fang klein an. Und wenn du Karten brauchst: Mein Laden steht immer dort, wo gerade ein Tisch frei wird.', 'cards']
  ] });
  scene('hahn-boss', 'Hundert Jahre', { bg: 'story/hahn-a', steps: [
    ['in', 'boss-house', 'r'],
    ['boss-house', 'Hundert Jahre. Auf diesem Stuhl saßen Bankiers, Generäle und ein Erzherzog. Keiner ist mit Schuhen gegangen.'],
    ['boss-house', 'Und nun du. Kein Name, kein Kredit, kein Deckel. Wer hat dich hereingelassen?', 'angry'],
    ['n', 'Du legst die Schachtel auf den Filz.'],
    ['boss-house', '… Woher hast du die?', 'shocked'],
    ['boss-house', 'Gleichviel. Mein Haus, meine Regeln. Am Ende gewinnt immer das Haus. Das steht so geschrieben. In warmer Tinte.', 'smug']
  ] });
  scene('hahn-ende', 'Der Herr im roten Frack', { bg: 'story/hahn-b', names: { 'boss-prince': 'Herr im roten Frack' }, steps: [
    ['fx', 'flash'],
    ['n', 'Der Tisch brennt. Dann der Tresor dahinter – von innen.'],
    ['in', 'boss-house', 'l'],
    ['boss-house', 'Der Vertrag … hundert Jahre Glück, unterschrieben, besiegelt … er brennt. Er darf gar nicht brennen.', 'shocked'],
    ['n', 'Der Hausherr sieht seine Hände an. Sie zittern. Zum ersten Mal seit hundert Jahren sehen sie aus wie die Hände eines alten Mannes.'],
    ['boss-house', 'Ich habe verloren. … Sag das noch einmal. Es klingt so leicht.', 'defeated'],
    ['in', 'boss-prince', 'r', 'shade'],
    ['n', 'In der Hintertür steht ein Herr im roten Frack. Niemand hat ihn klopfen hören.'],
    ['boss-prince', 'Guten Abend. Verzeihung, ich komme wegen einer Frist. Offenbar komme ich zu spät. Das ist mir neu.'],
    ['boss-prince', 'Diese Schachtel. Sie gehört mir.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Gehörte.', 'grin'],
    ['boss-prince', 'Manfred. Natürlich. Und Sie … stehen in keinem meiner Bücher. Wie ärgerlich. Wie erfrischend.'],
    ['boss-prince', 'Man sieht sich. Ganz unten. Früher oder später kommt jeder vorbei.'],
    ['out', 'boss-prince'],
    ['manfred', 'Das war er. Ihm gehören die Verträge. Der Spielbank gehören die Schulden. Und dir gehört jetzt ein Abend, den die Stadt nicht vergisst.', 'side'],
    ['news', 'Kein Brand im Goldenen Hahn', 'Verleger: Rauch über der Altstadt war Nebel'],
    ['manfred', 'Ein Haus. Elf noch.', 'match']
  ] });

  /* ---------- 2 · Tanzpalast Rialto ---------- */
  scene('rialto-ankunft', 'Zehn Pfennig das Lied', { bg: 'story/taxi', steps: [
    ['card', 'Zweites Haus', 'Tanzpalast Rialto'],
    ['in', 'taxi', 'r'],
    ['taxi', 'Wohin, Chef? … Zum Rialto. Dacht ich mir. Die halbe Stadt vertanzt da ihr Geld, die andere Hälfte fährt sie hin. Das bin ich.'],
    ['taxi', 'Hab mal einen gefahren, roter Frack. „Nach unten“, sagt er. Das Taxameter lief rückwärts. Seitdem lass ich es an. Sicher ist sicher.', 'shocked'],
    ['bg', 'story/rialto-a'],
    ['in', 'taxi-dancer', 'r'],
    ['taxi-dancer', 'Zehn Pfennig das Lied. Führen kostet extra. … Du bist das mit dem Hahn, stimmt’s? Hier redet man schon.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Das neue Rialto. Gebaut auf der Asche des alten und mit dem Geld der Spielbank. Die Raten steigen jeden Monat.'],
    ['taxi-dancer', 'Der Impresario sagt, das Haus gehört ihm. In einer Hutschachtel liegt ein Papier, das sagt etwas anderes. Ich habe nichts gesehen.', 'shocked'],
    ['manfred', 'Raten sind Papier. Und Papier …', 'match']
  ] });
  scene('rialto-boss', 'Das Finale', { bg: 'story/rialto-a', steps: [
    ['in', 'boss-impresario', 'r'],
    ['boss-impresario', 'Halt! Licht! So. Jetzt sieht man dich. Hm. Kein Bühnengesicht. Aber Feuer, das höre ich überall.', 'smug'],
    ['boss-impresario', 'Ich habe dieses Haus aus der Asche gestampft. Jeder Stern darin gehört mir, bis ich einen neuen finde.'],
    ['boss-impresario', 'Du willst mein Finale sein? Schön. Aber das Finale schreibe immer noch ich.', 'angry']
  ] });
  scene('rialto-ende', 'Zugabe', { bg: 'story/rialto-b', steps: [
    ['n', 'Im Messingeimer am Bühnenrand brennen die Ratenbriefe der Spielbank. Sie brennen gut.'],
    ['in', 'boss-impresario', 'l'],
    ['boss-impresario', 'Die Raten … weg. Dann gehört das Haus wieder mir! Ganz und gar –', 'shocked'],
    ['in', 'showgirl', 'r'],
    ['showgirl', 'Mir, Darling. Du hast es mir überschrieben. In einer schwachen Stunde. Und mich eine Woche später entlassen.', 'smug'],
    ['boss-impresario', 'Roxy …', 'defeated'],
    ['showgirl', 'Kapelle! Einen halben Ton TIEFER diesmal. Heute Abend: meine Zugabe.'],
    ['out', 'boss-impresario'],
    ['n', 'Ein Bote reicht dir ein Telegramm. Absender: Spielbank Monopol, Direktion. „Der Direktor lässt fragen, was Sie kosten.“'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Schreib zurück: mehr, als er hat. Das hat ihm noch keiner geschrieben.', 'grin'],
    ['news', 'Rialto unter neuer Leitung', 'Revuestern übernimmt – Impresario „aus künstlerischen Gründen“ beurlaubt']
  ] });

  /* ---------- 3 · Lunapark ---------- */
  scene('lunapark-ankunft', 'Jedes Los gewinnt', { bg: 'story/lunapark-a', steps: [
    ['card', 'Drittes Haus', 'Lunapark'],
    ['in', 'lottery-girl', 'r'],
    ['lottery-girl', 'Jedes Los gewinnt! Na ja. Jedes Los kostet. Der Teddy da oben hängt seit einunddreißig – der gewinnt hier am längsten!'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Der Rummel. Hier haben der Schieber und Rico das Mischen gelernt, bei Zampano. Jede Bude gezinkt, und trotzdem das ehrlichste Haus der Stadt: Man weiß es vorher.'],
    ['lottery-girl', 'Der Direktor zahlt jede Woche an die Donna. Schutzgeld. Und die Stadt will den Platz unterm Riesenrad verkaufen. An die Spielbank.', 'angry'],
    ['manfred', 'Ein Schutzgeldbuch und ein Räumungsbescheid. Zwei Papiere.', 'match'],
    ['lottery-girl', 'Der Bescheid ist im Teddy eingenäht. Psst.', 'smug']
  ] });
  scene('lunapark-boss', 'Manege frei', { bg: 'story/lunapark-a', steps: [
    ['in', 'boss-zampano', 'r'],
    ['boss-zampano', 'Hereinspaziert, hereinspaziert! Verehrtes Publikum: die Sensation aus dem Goldenen Hahn! Nie dagewesen! Feuerfest – noch!', 'smug'],
    ['boss-zampano', 'Ich habe dem Schieber das Mischen beigebracht. Ich weiß, wie ein gezinkter Abend aussieht. Deiner ist keiner. Das macht mir Sorgen.'],
    ['boss-zampano', 'Aber ein Zampano gibt keine Vorstellung, ohne zu kassieren. Manege frei!', 'angry']
  ] });
  scene('lunapark-ende', 'Die Asche kaufen', { bg: 'story/lunapark-b', steps: [
    ['n', 'Morgengrauen. Auf einem Fass vor dem Direktionswagen brennt das Schutzgeldbuch. Der Teddy brennt nicht – nur das Papier in seinem Bauch.'],
    ['in', 'boss-zampano', 'l'],
    ['boss-zampano', 'Vierzig Jahre Ausrufer, und mir fällt nichts ein. … Der Platz bleibt. Das Rad dreht sich. Sensationell.', 'defeated'],
    ['in', 'scrap-dealer', 'r'],
    ['scrap-dealer', 'Morgen. Brennt’s wieder? Ich nehm die Kessel. Und den Ofen. Kilopreis.'],
    ['n', 'Der Schrotthändler lädt auf, ohne zu fragen. Er wird dir von nun an nachfahren.'],
    ['in', 'boss-donna', 'r'],
    ['n', 'Am Zaun hält eine dunkle Limousine. Das Fenster fährt herunter.'],
    ['boss-donna', 'Du verbrennst mein Schutzgeldbuch. In meiner Stadt. Mutig.', 'angry'],
    ['boss-donna', 'Andererseits: Was abbrennt, wird billig. Ich kaufe die Asche. Mach weiter. Du arbeitest für mich – du weißt es nur noch nicht.', 'smug'],
    ['out', 'boss-donna'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Sie hat nicht ganz unrecht. Aber sie rechnet nur bis zum zehnten Haus.', 'side'],
    ['n', 'Hanni drückt dir den Teddy in die Hand. Hauptgewinn seit einunddreißig. „Jedes Los gewinnt“, sagt sie. Diesmal stimmt es.'],
    ['news', 'Lunapark bleibt', 'Stadt zieht Räumung zurück – Bescheid „nicht auffindbar“']
  ] });

  /* ---------- 4 · Rote Laterne ---------- */
  scene('laterne-ankunft', 'Paragraf sieben', { bg: 'story/laterne-a', steps: [
    ['card', 'Viertes Haus', 'Rote Laterne'],
    ['in', 'doorwoman', 'r'],
    ['doorwoman', 'Du bist das Streichholz. … Ich sage nicht Nein. Das sage ich selten.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Die Rote Laterne. Ein Abschiedsgeschenk der Donna an Samt-Eddie, mit Verträgen vom Consigliere. Paragraf sieben ist in jedem sehr lang.'],
    ['doorwoman', 'Jede hier hat so einen. Kitty auch. Der Ausstieg kostet genau so viel, wie keine je sparen kann.', 'angry'],
    ['doorwoman', 'Ich bleibe an der Tür. Wenn drinnen Papier brennt: Ich habe nichts gerochen.']
  ] });
  scene('laterne-boss', 'Die Hälfte', { bg: 'story/laterne-a', steps: [
    ['in', 'boss-eddie', 'r'],
    ['boss-eddie', 'Na, na, na. Das Streichholz. Setz dich, trink was, geht aufs Haus. Die Hälfte geht aufs Haus.', 'smug'],
    ['boss-eddie', 'Hör zu. Ich nehme von allem die Hälfte, und mir bleibt weniger als den Mädchen. Die Donna, die Bank, der Stadtrat … Ich bin der ärmste Reiche der Stadt.'],
    ['boss-eddie', 'Aber die Verträge kriegst du nicht. Ohne die bin ich nur ein Mann in einem geliehenen Anzug.', 'angry']
  ] });
  scene('laterne-ende', 'Der rote Umschlag', { bg: 'story/laterne-b', steps: [
    ['n', 'Im Papierkorb der Chefetage brennen die Verträge. Paragraf sieben brennt am längsten.'],
    ['in', 'boss-eddie', 'l'],
    ['boss-eddie', 'Der Anzug war geliehen. Der Stuhl auch. Bloß der Goldzahn ist echt. … Und der gehört Otto.', 'defeated'],
    ['in', 'doorwoman', 'r'],
    ['doorwoman', 'Die Tür mache ich weiter. Das Haus auch. Eddie: Du darfst die Gläser spülen.', 'smug'],
    ['out', 'boss-eddie'],
    ['out', 'doorwoman'],
    ['n', 'Auf dem Schreibtisch liegt ein roter Umschlag. Er lag vorhin noch nicht da. Das Siegel ist warm.'],
    ['n', 'Ein Vertrag. Alles, was du dir wünschst, in schöner Schrift. Unten eine Zeile für den Namen. Sie ist leer.'],
    ['in', 'esme', 'r'],
    ['esme', 'Nicht anfassen, Schätzchen. Die Tinte ist noch warm.', 'annoyed'],
    ['esme', 'Er bietet immer zuerst. Glück für ein Haus, eine Stimme, einen Ofen, der nie ausgeht. Er nimmt dafür keine Mark. Rate, was er nimmt.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Ich habe einmal mit ihm gefeilscht. Drei Stunden. Am Ende habe ich nichts unterschrieben und seine Streichhölzer eingesteckt. Mein bestes Geschäft.', 'grin'],
    ['esme', 'Dein einziges ohne Rabatt.', 'dreamy'],
    ['news', 'Rote Laterne: Türsteherin übernimmt', 'Wirtschafter Eddie „aus freien Stücken“ am Spülbecken']
  ] });

  /* ---------- 5 · Dampfer Fortuna ---------- */
  scene('fortuna-ankunft', 'Drei Bücher', { bg: 'story/fortuna-a', steps: [
    ['card', 'Fünftes Haus', 'Dampfer Fortuna'],
    ['in', 'sailor', 'r'],
    ['sailor', 'Willkommen an Bord. Ab der Dreimeilenzone gilt kein Gesetz. Nur ihres.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Mein Laden steht überall, wo ein Tisch frei wird. Auch auf dem Wasser. Leider.', 'annoyed'],
    ['sailor', 'Der Zahlmeister rudert nachts Säcke an Land. Die Kapitänin weiß es. Auf See wirft man keinen über Bord, den man noch als Köder braucht.'],
    ['manfred', 'Pfennig rechnet das Schiff arm. Zwei Bücher: eins für die Kapitänin, eins für die Spielbank. Sind die Zahlen rot genug, muss sie verkaufen.'],
    ['sailor', 'Drei Bücher. Vom dritten weiß er nichts.', 'smug']
  ] });
  scene('fortuna-boss', 'Ihr Kommando', { bg: 'story/fortuna-a', steps: [
    ['in', 'boss-captain', 'r'],
    ['boss-captain', 'Ein Auge habe ich beim Schieber gelassen. Das Schiff habe ich dem Impresario abgenommen. Ich weiß, was ein Abend kosten kann.'],
    ['boss-captain', 'Du brennst dich durch die Stadt, sagt man. Hier draußen brennt nichts ohne mein Kommando.', 'angry'],
    ['boss-captain', 'Schlag mich an meinem Tisch, und Pfennigs Bücher gehören dir. Verlierst du, schwimmst du. Fair? Fair.', 'smug']
  ] });
  scene('fortuna-ende', 'Schwund', { bg: 'story/fortuna-b', steps: [
    ['n', 'In der Feuerschale auf dem Kartentisch brennen zwei Bücher. Das dritte hält die Erste Offizierin unter dem Arm.'],
    ['in', 'purser', 'l'],
    ['purser', 'Das ist Bordeigentum! Das ist – Schwund! Das melde ich der Direktion!', 'shocked'],
    ['in', 'boss-captain', 'r'],
    ['boss-captain', 'Melde es persönlich, Pfennig. Das Beiboot liegt bereit. Rudern kannst du ja.', 'smug'],
    ['out', 'purser'],
    ['n', 'Durchs Fenster: ein kleines Boot, eine Laterne, ein Mann, der sehr schnell rudert.'],
    ['boss-captain', 'Mein alter Heizer ist zu einem Herrn im roten Frack gegangen. Der Ofen dort geht nie aus, sagt man.'],
    ['boss-captain', 'Wenn ganz unten einmal ein Wirt fehlt: Die Fortuna legt an. Sag ihm das, wenn du ihn siehst. Du siehst ihn.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Fünf Häuser. Der Direktor hat aufgehört, Telegramme zu schicken. Das ist kein gutes Zeichen. Für ihn.', 'side'],
    ['news', 'Zahlmeister über Bord gegangen', 'Spielbank dementiert jede Verbindung zur Fortuna']
  ] });

  /* ---------- 6 · Rennbahn Silberhuf ---------- */
  scene('rennbahn-ankunft', 'Die Quote', { bg: 'story/rennbahn-a', steps: [
    ['card', 'Sechstes Haus', 'Rennbahn Silberhuf'],
    ['in', 'bookie', 'r'],
    ['bookie', 'Da bist du ja! Die Quote auf dich steht bei … ich sage es nicht, sonst steigt sie. Schnell-schnell, komm mit!'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Otto. Wie steht meine Wette?'],
    ['bookie', 'Hundert zu eins, wie am ersten Tag! Ich ändere doch keine Quote, an die ich glaube!', 'shocked'],
    ['bookie', 'Im Keller unter der Tribüne steht der Totalisator. Jede Wette der Stadt läuft durch die Maschine. Sie gehört der Spielbank. Mein Schuldschein liegt drin. Ricos auch.'],
    ['manfred', 'Eine Maschine voller Papier.', 'match']
  ] });
  scene('rennbahn-boss', 'Um eine Nasenlänge', { bg: 'story/rennbahn-a', steps: [
    ['in', 'boss-toto', 'r'],
    ['boss-toto', 'Auf Ehre, man hat Sie mir kleiner beschrieben. Graf Toto. Der Name verpflichtet. Zu nichts mehr, aber er verpflichtet.'],
    ['boss-toto', 'Mein bestes Pferd heißt „Hundert zu Eins“. Es hat nie gewonnen. Die Maschine im Keller wüsste das zu verhindern.', 'smug'],
    ['boss-toto', 'Sie wollen in meinen Keller. Dann müssen Sie durch meine Loge. Bitte, nach Ihnen. Um eine Nasenlänge.']
  ] });
  scene('rennbahn-ende', 'Was Sie kosten', { bg: 'story/rennbahn-b', steps: [
    ['n', 'Der Totalisator brennt. Zahnräder, Papierbänder, tausende Wettscheine. Zwei davon tragen bekannte Namen.'],
    ['in', 'bookie', 'l'],
    ['bookie', 'Mein Schuldschein! Ricos auch! Weg! Ich bin – ich bin nicht ruiniert! Zum ersten Mal! Was macht man da?!', 'shocked'],
    ['in', 'boss-director', 'r'],
    ['n', 'Auf der Kellertreppe steht ein Herr im grauen Anzug. Er hat gewartet, bis es sich lohnt.'],
    ['boss-director', 'Direktor Monopol. Sie haben soeben eine Maschine vernichtet, die mehr wert war als dieses Gestüt. Ich bin nicht verärgert. Ich bin interessiert.'],
    ['boss-director', 'Ich habe Ihre Akte anlegen lassen. Sie ist leer. Keine Schulden, kein Kredit, keine Schwäche. So etwas gibt es nicht.', 'angry'],
    ['boss-director', 'Also frage ich direkt. Die Schachtel. Nennen Sie eine Zahl.'],
    ['n', 'Du nennst keine.'],
    ['boss-director', 'Jeder hat einen Preis. Ihren kenne ich nur noch nicht. Guten Abend.', 'smug'],
    ['out', 'boss-director'],
    ['in', 'manfred', 'r'],
    ['manfred', 'Er hat dich gefragt, was du kostest, und du hast nichts gesagt. Jetzt schläft er schlecht. Sehr gut.', 'grin'],
    ['news', 'Rechenfehler auf der Rennbahn', 'Sämtliche Wetten ungültig – Buchmacher feiert „aus Versehen“']
  ] });

  /* ---------- 7 · Block 9 ---------- */
  scene('block9-ankunft', 'Nicht gelesen', { bg: 'story/block9-a', steps: [
    ['card', 'Siebtes Haus', 'Block 9'],
    ['in', 'rapper', 'r'],
    ['rapper', 'Yo. Du bist das Streichholz? Ich habe eine Zeile über dich. Reimt sich auf „abgebrannt“. Ich arbeite noch dran.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Block 9. Bezahlt von der Spielbank, die wollte junges Publikum. Papa Platin wollte nur das Geld.'],
    ['rapper', 'Ich habe mit sechzehn unterschrieben. Nicht gelesen. Milan hat es gelesen. Seitdem guckt er mich so an.', 'defeated'],
    ['in', 'producer', 'r'],
    ['producer', 'Platin hat noch einen zweiten Vertrag im Studio. Roter Umschlag, warme Tinte. Er hat nicht unterschrieben. Noch nicht.'],
    ['producer', 'Und ich habe acht Takte, die jemandem fehlen. Aber das ist eine andere Geschichte. Vielleicht.']
  ] });
  scene('block9-boss', 'Elf Platten', { bg: 'story/block9-a', steps: [
    ['in', 'boss-label', 'r'],
    ['boss-label', 'Elf Platinplatten. Nicht eine davon habe ich gesungen. Man verdient an denen, die es tun.', 'smug'],
    ['boss-label', 'Du machst gerade die ganze Stadt schuldenfrei. Weißt du, was das für mein Geschäft heißt? Freie Künstler. Grauenhaft.', 'angry'],
    ['boss-label', 'Im Studio liegt ein Angebot, gegen das dein Feuerchen ein Witz ist. Zeig mir, dass ich es nicht brauche.']
  ] });
  scene('block9-ende', 'Acht Takte', { bg: 'story/block9-b', steps: [
    ['n', 'Lil Zünds Vertrag brennt zuerst. Dann der Kredit der Spielbank. Der rote Umschlag liegt daneben und brennt nicht.'],
    ['in', 'boss-label', 'l'],
    ['boss-label', 'Der brennt bei dir nicht, was? Nur was unterschrieben ist. Ich habe nicht unterschrieben.'],
    ['n', 'Papa Platin nimmt den Umschlag. Sieht ihn lange an. Dann hält er ihn selbst in die Flamme.'],
    ['boss-label', 'Ich wollte abwarten, wie es dem Hausherrn ergeht. Habe ich jetzt. … Sag keinem, dass ich weich geworden bin.', 'defeated'],
    ['in', 'producer', 'r'],
    ['producer', 'Hör mal. Acht Takte. Habe ich rückwärts gefunden, beim Schneiden. Der Schluss von einem Lied, das ein alter Mann jede Nacht falsch spielt.'],
    ['producer', 'Noch nicht. Erst wenn sie es hören kann.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Die Sirene. Sie singt ganz unten. In ihrem Vertrag steht, sie ist frei, sobald jemand ihr Lied zu Ende spielt. Heb dir das auf.', 'side'],
    ['news', 'Lil Zünd vertragsfrei', 'Label spricht von „Wasserschaden mit Brandfolge“']
  ] });

  /* ---------- 8 · Nachtexpress ---------- */
  scene('express-ankunft', 'Erster Klasse', { bg: 'story/express-a', steps: [
    ['card', 'Achtes Haus', 'Nachtexpress'],
    ['in', 'conductor', 'r'],
    ['conductor', 'Die Fahrkarten, bitte! Abfahrt dreiundzwanzig Uhr sieben. Dieser Zug hält nicht. Seit dreißig Jahren nicht. Knips!'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Sieh dir die Fahrgäste an. Der Graf. Die Erbin. Der halbe Stadtrat. Die Stadt wird ihnen zu warm. Die Ratten reisen erster Klasse.'],
    ['conductor', 'Im Gepäckwagen: vierzig Kisten. Absender Spielbank Monopol. Inhalt laut Frachtbrief: Papier. Ich kontrolliere nur Fahrkarten.'],
    ['manfred', 'Der Direktor schafft seine Schuldscheine aus der Stadt. Vor dir in Sicherheit. Dann fahren wir eben mit.', 'side'],
    ['conductor', 'Angehalten wird nur, wenn die Lokführerin es sagt. Und die sagt es nie.', 'smug']
  ] });
  scene('express-boss', 'Volldampf', { bg: 'story/express-a', steps: [
    ['in', 'boss-else', 'r'],
    ['boss-else', 'Brunhilde und ich fahren diese Strecke seit dreißig Jahren. Ich frage nicht, wer einsteigt. Ich frage nicht, was im Gepäckwagen liegt.'],
    ['boss-else', 'Mein Bruder schaufelt ganz unten in einen Ofen, der nie ausgeht. Ich habe den gewählt, der einen irgendwohin bringt. Jeder heizt, wofür er kann.'],
    ['boss-else', 'Du willst, dass dieser Zug hält? Dann musst du mich schlagen. Volldampf!', 'angry']
  ] });
  scene('express-ende', 'Die Einladung', { bg: 'story/express-b', names: { 'boss-prince': 'Herr im roten Frack' }, steps: [
    ['n', 'Der Nachtexpress steht. Zum ersten Mal seit dreißig Jahren. Im Schnee brennen vierzig Kisten Papier.'],
    ['in', 'boss-else', 'l'],
    ['boss-else', 'Sie steht. Hörst du das? … Nichts. So klingt das also.', 'defeated'],
    ['boss-else', 'Ich schreibe meinem Bruder eine Karte. Auf der regnet es. Die mag er.'],
    ['out', 'boss-else'],
    ['bg', 'story/express-a'],
    ['n', 'Im Speisewagen sitzt ein einzelner Gast. Roter Frack. Vor ihm zwei Gedecke.'],
    ['in', 'boss-prince', 'r'],
    ['boss-prince', 'Setzen Sie sich. Ich habe mir erlaubt zu bestellen. Sie essen nichts? Klug.'],
    ['boss-prince', 'Sie verbrennen Schuldscheine. Bitte sehr. Schulden sind Menschenwerk, die wachsen nach. Meine Verträge sind etwas anderes. Die hält man.'],
    ['boss-prince', 'Ich könnte Ihnen etwas anbieten. Ich habe es versucht. Sie haben den Umschlag nicht einmal angefasst. Also biete ich Ihnen ein Spiel.', 'angry'],
    ['boss-prince', 'Kommen Sie herunter. Mein Tisch, meine Karten, Ihre Schachtel. Gewinnen Sie, brennt, was ich besitze. Verlieren Sie, unterschreiben Sie. Endlich.', 'smug'],
    ['out', 'boss-prince'],
    ['n', 'Als du blinzelst, ist der Stuhl leer. Das Gedeck ist warm.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Er lädt nie ein. Er holt ab. Dass er dich einlädt, heißt: Er kann dich nicht holen.', 'surprised'],
    ['news', 'Stadt über Nacht schuldenfrei?', 'Spielbank spricht von „Buchungsfehler“ – vierzig Kisten vermisst']
  ] });

  /* ---------- 9 · Grandhotel Imperial ---------- */
  scene('imperial-ankunft', 'Man hat Sie erwartet', { bg: 'story/imperial-a', steps: [
    ['card', 'Neuntes Haus', 'Grandhotel Imperial'],
    ['in', 'concierge', 'r'],
    ['concierge', 'Willkommen im Imperial. Man hat Sie erwartet. Man erwartet hier jeden, das ist mein Beruf. Eine Krawatte liegt bereit.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Die Hypothek auf dieses Haus liegt bei der Spielbank. Laurent zahlt die Raten seit drei Jahren aus eigener Tasche, damit die Baronin es nicht merkt.', 'side'],
    ['concierge', 'Ich muss doch sehr bitten. … Woher wissen Sie das?', 'shocked'],
    ['manfred', 'Von der jungen Dame, die dir einen Schlüssel abgekauft hat. Sie ist bei mir aufgewachsen.'],
    ['concierge', 'Die Frau Baronin spielt im Penthouse. Sie kommt nur zum Kartenspiel herunter. Heute, fürchte ich, kommt sie Ihretwegen.']
  ] });
  scene('imperial-boss', 'Was sie übersieht', { bg: 'story/imperial-a', steps: [
    ['in', 'boss-baroness', 'r'],
    ['boss-baroness', 'Mein Urgroßvater hat dieses Haus am Spieltisch gewonnen. Ich gedenke nicht, es dort zu verlieren.'],
    ['boss-baroness', 'Ich weiß, dass Laurent meine Raten zahlt. Ich weiß, an wessen Hals mein Collier hängt. Eine Hohenstein erkennt man daran, was sie übersieht.', 'smug'],
    ['boss-baroness', 'Sie dagegen übersehe ich nicht. Setzen Sie sich. Und nehmen Sie die Schachtel vom Tischtuch.', 'angry']
  ] });
  scene('imperial-ende', 'Weiße Lilien', { bg: 'story/imperial-b', steps: [
    ['n', 'Die Hypothek brennt im Kamin des Penthouse. Die Baronin sieht zu, bis das letzte Siegel schmilzt.'],
    ['in', 'boss-baroness', 'l'],
    ['boss-baroness', 'Vierzig Jahre hat er mir die Zeitung gebügelt und nie ein Wort gesagt. Laurent! Zwei Tassen. Nein: drei.'],
    ['in', 'black-widow', 'r'],
    ['n', 'Auf dem Tisch stehen weiße Lilien. Diesmal mit Karte.'],
    ['black-widow', 'Sie haben mich rufen lassen. Nach all den Jahren. Ich dachte immer, die Lilien wären eine Drohung.', 'shocked'],
    ['boss-baroness', 'Ich auch. Dann hat mir eine Krankenschwester etwas erzählt, wonach nie jemand gefragt hatte. Mein Sohn war krank, Kind. Nicht verflucht. Setz dich.'],
    ['black-widow', '…', 'defeated'],
    ['out', 'black-widow'],
    ['boss-baroness', 'Und nun zu Ihnen. Die alten Familien haben ihn einst hereingebeten, den Herrn im roten Frack. Meine auch. Wir nannten es Fortschritt.'],
    ['boss-baroness', 'Seine Konzession liegt im Ratskeller, im Archiv. „Ein Lokal ganz unten.“ Suchen Sie das Kleingedruckte. Es gibt immer eines.'],
    ['in', 'manfred', 'r'],
    ['manfred', 'Der Ratskeller. Oben wird regiert, unten wird verteilt. Zieh dir etwas Anständiges an.', 'hat'],
    ['news', 'Hohenstein schuldenfrei', 'Baronin empfängt Witwe zum Tee – Gesellschaft ratlos']
  ] });

  /* ---------- 10 · Ratskeller ---------- */
  scene('ratskeller-ankunft', 'Vorgang zehn', { bg: 'story/ratskeller-a', steps: [
    ['card', 'Zehntes Haus', 'Ratskeller'],
    ['in', 'usher', 'r'],
    ['usher', 'Ich trage das nur aus. Vorgang zehn, Betreff: Sie. Der Herr Oberbürgermeister lässt bitten. Unten. Oben wird nur regiert.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Hier unten verteilt die Stadt sich selbst. Konzessionen, Baugenehmigungen, Sperrstunden. Jede Unterschrift hat ihren Preis.'],
    ['usher', 'Vierzig Jahre trage ich Akten. Keiner liest sie. Ich schon. Abends. Es ist sonst so still.'],
    ['usher', 'Im Archiv liegt eine, die ist hundert Jahre alt. Die Tinte ist noch warm. Ich fasse sie nur mit Handschuhen an.', 'shocked'],
    ['manfred', 'Die brauchen wir. Die verbrennen wir nicht. Die lesen wir.', 'cards']
  ] });
  scene('ratskeller-boss', 'Ein einfacher Bürger', { bg: 'story/ratskeller-a', steps: [
    ['in', 'boss-mayor', 'r'],
    ['boss-mayor', 'Ah, da sind Sie ja! Kommen Sie, setzen Sie sich. Ein Gläschen? Ich bin ja nur ein einfacher Bürger.'],
    ['boss-mayor', 'Mein Urgroßvater hat da einmal etwas unterschrieben. Ein Lokal, ganz unten – was soll schon sein. Man ist ja gastfreundlich.', 'smug'],
    ['boss-mayor', 'Ich unterschreibe alles, was man mir vorlegt. Das nennt man Verwaltung. Sie wollen mein Archiv anzünden? Aber bitte. Erst spielen wir. Ich rede auch nur ganz kurz.']
  ] });
  scene('ratskeller-ende', 'Das Kleingedruckte', { bg: 'story/ratskeller-b', steps: [
    ['n', 'Das Archiv brennt. Hundert Jahre Gefälligkeiten, Regal um Regal. Eine einzige Akte liegt auf dem Pult, und das Feuer geht um sie herum.'],
    ['in', 'usher', 'r'],
    ['usher', 'Ich habe sie herausgenommen. Ich trage sonst nur aus. Aber diesmal trage ich es zu Ihnen.', 'smug'],
    ['n', 'Die Konzession. „Ein Lokal ganz unten.“ Erteilt auf unbestimmte Zeit –'],
    ['in', 'manfred', 'l'],
    ['manfred', '– „solange in dieser Stadt auf Kredit gespielt wird“. Das ist das Kleingedruckte.', 'surprised'],
    ['manfred', 'Verstehst du? Solange im Tresor der Spielbank ein einziger Schuldschein liegt, gilt seine Konzession. Die Schulden der Stadt sind sein Fundament.'],
    ['in', 'boss-mayor', 'r'],
    ['boss-mayor', 'Ich war ja immer schon auf Ihrer Seite! Von Anfang an! Darf ich das irgendwo unterschreiben?', 'shocked'],
    ['manfred', 'Nein.', 'annoyed'],
    ['news', 'Archivbrand im Rathaus', 'Oberbürgermeister: „Die Akten waren ohnehin veraltet“']
  ] });

  /* ---------- 11 · Spielbank Monopol ---------- */
  scene('monopol-ankunft', 'Das leere Fach', { bg: 'story/monopol-a', steps: [
    ['card', 'Elftes Haus', 'Spielbank Monopol'],
    ['in', 'croupier', 'r'],
    ['croupier', 'Faites vos jeux. … Sie sind das. Emil hat mir geschrieben. Er schreibt sonst nie.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Die Spielbank. Hier gewinnt die Bank, es steht im Namen. Am Ende des Saals: der Tresor. Kaum Geld darin. Nur Papier. Die Schulden der halben Stadt.'],
    ['croupier', 'Die Kessel laufen nicht rund. Ich lasse die Kugel manchmal fallen, wie sie will. Heute den ganzen Abend.', 'smug'],
    ['in', 'vault-guard', 'r'],
    ['vault-guard', '… Ich bewache die Tür. Was drin ist, interessiert mich nicht. Nur ganz hinten das leere Fach. „Zum Goldenen Hahn“. Das hat mich immer interessiert.'],
    ['manfred', 'Das einzige Haus, das nie Schulden hatte. Es hatte Besseres.', 'side']
  ] });
  scene('monopol-boss', 'Ein Buchungsfehler', { bg: 'story/monopol-a', steps: [
    ['in', 'boss-director', 'r'],
    ['boss-director', 'Ich habe Ihre Akte noch einmal anlegen lassen. Dreimal. Sie bleibt leer. Sie sind der einzige Mensch in dieser Stadt, den ich nicht besitze.', 'angry'],
    ['boss-director', 'Ich habe Ihnen Kredit angeboten. Geschenke. Einen Sitz im Direktorium. Sie haben nichts genommen. Das ist keine Tugend. Das ist ein Buchungsfehler.'],
    ['boss-director', 'Ich spiele nicht. Ich lasse spielen. Für Sie mache ich eine Ausnahme und verbuche sie als Abschreibung.', 'smug']
  ] });
  scene('monopol-ende', 'Ganz unten', { bg: 'story/monopol-b', steps: [
    ['fx', 'flash'],
    ['n', 'Der Tresor steht offen. Die Schuldscheine der halben Stadt brennen in einer einzigen Flamme. Ganz hinten: ein leeres Fach.'],
    ['in', 'boss-director', 'l'],
    ['boss-director', 'Wissen Sie, was Sie getan haben? Sie haben den Wert von allem vernichtet. Auch den Ihrer Gewinne. Niemand schuldet mehr irgendwem irgendetwas.', 'shocked'],
    ['boss-director', '… Merkwürdig. Ich habe vierzig Jahre lang nicht gewusst, wie leicht ein leerer Tresor ist.', 'defeated'],
    ['boss-director', 'Eine Warnung, kostenlos. Mein erstes Geschenk. Ich habe einmal ein Geschäft mit ihm abgelehnt: Mit ihm macht nur einer Gewinn.'],
    ['boss-director', 'Seine Konzession ist soeben erloschen. Ihm bleibt nur, was unterschrieben ist. Er wird hungrig sein.'],
    ['in', 'manfred', 'r'],
    ['n', 'Der Boden des Tresors ist warm. Unter dem leeren Fach führt eine Treppe nach unten. Sie war schon immer da.'],
    ['manfred', 'Ganz unten. Elf Häuser. Eins noch.', 'match'],
    ['news', 'Spielbank Monopol zahlungsunfähig', 'Direktor: „Erstmals ohne Verbindlichkeiten“']
  ] });

  /* ---------- 12 · Das Inferno ---------- */
  scene('inferno-ankunft', 'Klausel eins', { bg: 'story/taxi', steps: [
    ['card', 'Letztes Haus', 'Das Inferno'],
    ['in', 'taxi', 'r'],
    ['taxi', 'Bis hierhin, Chef. Weiter fahre ich nicht. Guck: Das Taxameter läuft rückwärts. … Ich warte. Ich lasse die Uhr laufen. Geht aufs Haus.', 'shocked'],
    ['bg', 'story/inferno-a'],
    ['in', 'stoker', 'r'],
    ['stoker', 'Du bist das also. Ich schaufle hier seit Jahren Verträge in den Ofen. Jeder, der abläuft, gibt eine Schaufel.'],
    ['stoker', 'Auf der nächsten steht der Name des Hausherrn. Ich habe sie beiseitegestellt. Wollte sehen, wie dein Abend ausgeht.'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Weiter kann ich nicht mit. Mein Laden steht überall, wo ein Tisch frei wird – hier wird nie einer frei.', 'annoyed'],
    ['manfred', '… Ach was. Ich habe hier einmal drei Stunden gefeilscht. Ich finde den Weg.', 'grin'],
    ['in', 'notary', 'r'],
    ['notary', 'Notarin Tinte, Komma, im Auftrag. Sie stehen in keiner Akte, Punkt. Das ist unerträglich, Ausrufezeichen.', 'angry'],
    ['notary', 'Eine Belehrung, weil ich muss: Seine Verträge brennen nur mit Feuer aus seiner eigenen Schachtel. Klausel eins. Er hat sie nie gelesen. Ich habe sie geschrieben.']
  ] });
  scene('inferno-boss', 'Das unbeschriebene Blatt', { bg: 'story/inferno-a', names: { 'boss-prince': 'Der Fürst' }, steps: [
    ['in', 'boss-prince', 'r'],
    ['boss-prince', 'Da sind Sie. Pünktlich. Ich schätze das. Bitte: mein Tisch. Er ist älter als die Stadt.'],
    ['boss-prince', 'Ich habe dem Wirt hundert Jahre Glück gegeben. Der Witwe ihre Flüche. Dem Mädchen eine Stimme. Ich habe nie gelogen. Ich habe nur nie alles gesagt.'],
    ['boss-prince', 'Sie sind das Einzige in dieser Stadt, das mir nicht gehört. Ein unbeschriebenes Blatt. Ich möchte sehr gern darauf schreiben.', 'smug'],
    ['n', 'Du schiebst die Schachtel in die Mitte des Tisches. Drei Hölzer. Mehr waren nie drin.'],
    ['boss-prince', 'Mein eigenes Feuer. Wie unhöflich. Wie angemessen. Geben Sie.', 'angry']
  ] });
  scene('inferno-ende', 'Der Schluss des Liedes', { bg: 'story/inferno-b', names: { 'boss-prince': 'Der Fürst', siren: 'Die Sirene' }, steps: [
    ['fx', 'flash'],
    ['n', 'Der Tisch des Fürsten brennt. Er ist älter als die Stadt, und er brennt wie Papier.'],
    ['n', 'Heizer Ruß öffnet die Ofentür. Tausende Verträge fliegen hinein, ohne dass jemand schaufelt. Die Tinte ist endlich kalt.'],
    ['in', 'boss-prince', 'l'],
    ['boss-prince', 'Ich habe verloren. … Sie müssen entschuldigen, mir fehlt die Übung.', 'defeated'],
    ['boss-prince', 'Man verliert nicht gern. Aber man zahlt. Ich bin vieles. Ein Zechpreller bin ich nicht.'],
    ['in', 'siren', 'r'],
    ['n', 'Auf der kleinen Bühne hat die Sirene aufgehört zu singen. Durch die Tür kommt Klaviermusik: dasselbe Lied wie jede Nacht – zum ersten Mal in der richtigen Tonart.'],
    ['n', 'Fingers spielt. Milan steht daneben und blättert um. Acht Takte, die immer gefehlt haben.'],
    ['siren', 'Das ist der Schluss. Ich habe ihn nie gesungen. Er hat ihn trotzdem gefunden. … Ich heiße Marie. Ich hatte es vergessen.', 'shocked'],
    ['out', 'siren'],
    ['in', 'manfred', 'r'],
    ['boss-prince', 'Manfred. Du hattest also doch einen Vertrag. Eine Wette.'],
    ['manfred', 'Hundert zu eins, dass das Haus brennt. Ich habe nie gesagt, welches.', 'grin'],
    ['boss-prince', '… Ich hätte dich damals unterschreiben lassen sollen. Guten Abend. Die Schachtel dürfen Sie behalten. Sie ist ohnehin leer.'],
    ['out', 'boss-prince'],
    ['news', 'Das Inferno schließt', 'Hundert Jahre Glück vorbei – Stadt muss ab sofort selbst gewinnen']
  ] });

  /* ---------- Epilog ---------- */
  scene('epilog', 'Morgen', { bg: 'story/epilog-harbor', steps: [
    ['card', 'Epilog', 'Morgen'],
    ['n', 'Am Kai ganz unten legt ein Schaufelraddampfer an. Lampions, ein Schiffshorn, an der Reling eine Kapitänin mit einem Auge.'],
    ['in', 'boss-captain', 'r'],
    ['boss-captain', 'Ich habe es versprochen: Fehlt hier ein Wirt, lege ich an. Ab heute wird hier um Geld gespielt. Nur um Geld. Das ist schlimm genug.', 'smug'],
    ['in', 'stoker', 'l'],
    ['stoker', 'Kapitänin. Der Ofen ist aus. Zum ersten Mal. Ich würde gern wieder einmal Regen sehen.'],
    ['boss-captain', 'An Deck, Ruß. Es regnet seit drei Tagen. Extra für dich.'],
    ['out', 'boss-captain'],
    ['out', 'stoker'],
    ['bg', 'story/epilog-dawn'],
    ['n', 'Die Gasse hinter dem Goldenen Hahn. Es hat aufgehört zu regnen. Die Stadt riecht nach kaltem Rauch und frischen Brötchen.'],
    ['in', 'bookie', 'r'],
    ['bookie', 'Hundert zu eins! HUNDERT ZU EINS! Ich bin ruiniert! Schon wieder! Und diesmal freue ich mich!', 'shocked'],
    ['in', 'manfred', 'l'],
    ['manfred', 'Auszahlung an die Dame im Nebenzimmer, Otto. Die halbe Miete. Mit Zinsen.', 'coin'],
    ['in', 'esme', 'r'],
    ['esme', 'Die Miete habe ich längst nachgerechnet, Manfred. Du zahlst seit Jahren zu wenig.', 'annoyed'],
    ['esme', 'Unter meiner Kasse liegt seit Jahren eine Karte. Rote Weste, flinke Finger, erbärmlich im Kopfrechnen. Ich wollte sie heute Morgen umdrehen.', 'dreamy'],
    ['manfred', 'Und?', 'surprised'],
    ['esme', 'Sie lag schon mit dem Gesicht nach oben.'],
    ['n', 'Du stehst daneben und siehst weg. Es ist das Höflichste, was dir einfällt.'],
    ['out', 'esme'],
    ['manfred', 'Kundschaft. Zwölf Häuser. Kein Vertrag mehr in der Stadt, kein Schuldschein, und der Hausherr geht jeden Morgen spazieren, weil er es darf.', 'hat'],
    ['manfred', 'Die Schachtel ist leer, sagt er. Hm.', 'match'],
    ['n', 'Manfred schüttelt sie. Es klappert. Drei Stück. Mehr sind nie drin.'],
    ['manfred', 'Die Stadt ist frei. Gespielt wird trotzdem. Noch eine Runde?', 'wink'],
    ['card', 'Zündung', 'Danke fürs Spielen.']
  ] });

  /* ---------- Zwischenspiele: einmalig, beim ersten Anlass ---------- */
  scene('laden', 'Manfreds Laden', { bg: 'manfred/shop', steps: [
    ['in', 'manfred', 'l'],
    ['manfred', 'Willkommen in meinem Laden. Er steht immer dort, wo gerade ein Tisch frei wird. Frag nicht, wie.', 'hat'],
    ['manfred', 'Karten, Spezialkarten, Trinkets. Und was dir im Deck nur im Weg ist, verbrenne ich dir. Gegen Gebühr. Ich bin Händler, kein Wohltäter.', 'coin'],
    ['manfred', 'Was vom Papier übrig bleibt, heißt Asche. Dafür interessiert man sich im Hinterzimmer. Bring welche mit.', 'wink']
  ] });
  scene('esme', 'Das Nebenzimmer', { bg: 'esme/room', steps: [
    ['in', 'esme', 'r'],
    ['esme', 'Herein, Schätzchen. Ich habe dich erwartet. Das sage ich jedem, aber bei dir stimmt es.', 'dreamy'],
    ['esme', 'Ich veredle Karten. Ein Siegel hier, ein kleiner Makel da – die Makel machen es billig. Lies das Kleingedruckte. Bei mir gibt es wenigstens welches.', 'greedy'],
    ['esme', 'Deine Karten zeigen mir übrigens nichts. Kein Faden, kein Knoten, kein Name. Das ist mir erst einmal passiert. Der andere trug einen roten Frack.', 'surprised']
  ] });
  scene('holz', 'Das erste Streichholz', { bg: 'story/prolog-box', steps: [
    ['n', 'Ein Streichholz ist abgebrannt.'],
    ['in', 'manfred', 'r'],
    ['manfred', 'Eins weg. Das gehört dazu. Wer nie verliert, hat unterschrieben – frag den Hausherrn.', 'side'],
    ['manfred', 'Solange eins übrig ist, sitzt du gleich wieder am selben Tisch. Sind alle weg, sehen wir uns morgen. Die Schachtel füllt sich nach.', 'match']
  ] });
  scene('brand', 'Der erste Brand', { bg: 'story/hahn-a', steps: [
    ['in', 'manfred', 'r'],
    ['manfred', 'Hast du das gesehen? Der Tisch hat gebrannt. Glutziel erreicht, Spiel vorbei – egal wie viele Karten du noch hältst.', 'surprised'],
    ['manfred', 'Lange Ketten, hohe Karten, und nicht ziehen, wenn es sich vermeiden lässt. Je heißer der Tisch, desto mehr zahlt das Haus. Und desto mehr Asche bleibt.', 'grin']
  ] });

  ZU.STORY = S;
  /* Reihenfolge und Gliederung für die Chronik im Hauptmenü. */
  ZU.STORY_CHAPTERS = [{ title: 'Prolog', scenes: ['prolog', 'laden', 'esme', 'holz', 'brand'] }]
    .concat(ZU.CASINOS.map(function (casino) {
      return { title: casino.name, casino: casino.id, scenes: [casino.id + '-ankunft', casino.id + '-boss', casino.id + '-ende'] };
    }))
    .concat([{ title: 'Epilog', scenes: ['epilog'] }]);

  /* Alle Zeilen, die gesprochen werden, mit ihrer Kennung: [{ id, scene, who, name, mood, text }].
     who: 'erzaehler', 'zeitung', 'manfred', 'esme' oder die Kennung eines Gegners. */
  ZU.storyLines = function (sceneId) {
    var def = S[sceneId], out = [], n = 0;
    if (!def) return out;
    def.steps.forEach(function (step, index) {
      var kind = step[0];
      if (['card', 'bg', 'in', 'out', 'fx'].indexOf(kind) >= 0) return;
      n++;
      var who = kind === 'n' ? 'erzaehler' : kind === 'news' ? 'zeitung' : kind;
      out.push({
        id: sceneId + '-' + (n < 10 ? '0' : '') + n, step: index, scene: sceneId, who: who,
        name: ZU.storyName(who, def), mood: kind === 'n' || kind === 'news' ? '' : step[2] || '',
        text: kind === 'news' ? step[1] + '. ' + (step[2] || '') : step[1]
      });
    });
    return out;
  };
  ZU.storyName = function (who, def) {
    if (def && def.names && def.names[who]) return def.names[who];
    if (who === 'erzaehler') return 'Erzähler';
    if (who === 'zeitung') return 'Zeitungsjunge';
    if (who === 'manfred') return 'Manfred';
    if (who === 'esme') return 'Esme';
    return ZU.ENEMIES[who] ? ZU.ENEMIES[who].name : who;
  };
  /* Fingerabdruck eines Textes (für die Zuordnung von Aufnahmen). */
  ZU.textHash = function (text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
  };
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
