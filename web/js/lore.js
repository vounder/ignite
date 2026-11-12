/* Zündung – Akten: die Geschichte hinter jeder Figur. Reine Texte.
   Je Figur drei Einträge; sie öffnen sich in der Kartei mit der Zahl der Siege über sie (ZU.LORE_STEPS).
   Die Geschichten greifen ineinander: Wer wen kennt, wem wer etwas schuldet und warum das Haus gerade jetzt brennen kann. */
(function (ZU) {
  'use strict';

  /* Siege, ab denen Eintrag 1, 2 und 3 zu lesen sind – je nach Art der Figur. */
  ZU.LORE_STEPS = { battle: [1, 3, 6], elite: [1, 3, 5], boss: [1, 2, 4] };

  ZU.LORE = {
    // ---------- Tische ----------
    'ember-croupier': [
      'Emil gibt seit zwanzig Jahren im Goldenen Hahn die Karten. Er hat nie selbst gespielt, nie getrunken und nie gefehlt. Das Haus nennt ihn zuverlässig. Emil nennt es Angst.',
      'Er hat Klara das Geben beigebracht, Abend für Abend, bis sie besser war als er. Dann warb die Spielbank Monopol sie ab. Emil hat ihr zum Abschied sein bestes Kartenspiel geschenkt und es nie bereut – sagt er.',
      'Emil meldet alles nach oben, auch dich. Was er nicht meldet: Im Tresor des Hausherrn hat er einmal einen Vertrag gesehen, hundert Jahre alt, unterschrieben in einer Tinte, die noch warm war.'
    ],
    'curse-dealer': [
      'Mortimer verkauft keine Karten, er verkauft Pech. Wer bei ihm zieht, zieht mehr, als er wollte. Woher er das kann, sagt er nicht – aber er zuckt, wenn jemand Vera erwähnt.',
      'Er war Veras Lehrling. Sie zeigte ihm, wie man einem Blatt etwas einflüstert. Als ihr dritter Mann starb, lief Mortimer davon und versteckt sich seitdem hinter seinem Kichern.',
      'Mortimers Flüche stammen nicht von Vera. Sie hat sie selbst nur geliehen, von einem Herrn im roten Frack, der einmal im Jahr die Zinsen holt. Mortimer weiß das. Deshalb zahlt er pünktlich.'
    ],
    cheater: [
      'Rico hat in jeder Stadt südlich der Alpen Hausverbot. Im Hahn duldet man ihn, weil er dem Schieber die Hälfte abgibt und die andere Hälfte an der Bar lässt.',
      'Das Ass im Ärmel hat ihm der Schieber beigebracht, damals, als beide noch auf Jahrmärkten spielten. Rico behauptet, er sei der bessere von beiden gewesen. Der Schieber lacht darüber sehr laut und sehr kurz.',
      'Rico schuldet Quoten-Otto eine Summe, die keiner von beiden laut ausspricht. Otto hat den Schuldschein längst an die Spielbank verkauft. Seitdem schläft Rico mit den Schuhen an.'
    ],
    'cigarette-girl': [
      'Lola verkauft Zigaretten, Zigarren und gute Laune. Die 7 in ihrem Bauchladen hat sie immer dabei. „Feuer gefällig“ ist kein Angebot, sondern eine Warnung.',
      'Sie und Mimi haben zusammen in einer Mansarde gewohnt und vom Tanzpalast geträumt. Mimi hat es ins Rialto geschafft. Lola schickt ihr jede Woche eine Schachtel der Guten, ohne Absender.',
      'Lola hört an jedem Tisch mit, und Madame Rauch zahlt gut für das, was sie hört. Nur eines hat sie nie weitergesagt: wer in der Brandnacht im alten Rialto die Streichhölzer bei ihr gekauft hat.'
    ],
    barkeeper: [
      'Bruno spricht in ganzen Sätzen nur mit Gläsern. Er war Boxer, bis ihm Knochen-Kalle im Training den Kiefer brach. Die beiden sind seither befreundet, auf ihre Art.',
      'Vor dem Ring fuhr Bruno zur See, als Schiffskoch auf einem Frachter mit Matrose Hein. Hein hat ihm das Leben gerettet. Bruno schickt ihm jedes Jahr eine Flasche, Hein schickt sie leer zurück.',
      'Bruno kennt die Sperrstunde jedes Gastes, auch die letzte. Für den Hausherrn hat er sie sich aufgeschrieben, auf einen Bierdeckel hinter der Kasse. Das Datum darauf ist dieses Jahr.'
    ],
    showgirl: [
      'Roxy war der Stern des Rialto: drei Shows am Abend, ihr Name in Glühbirnen. Heute tritt sie im Hahn zwischen den Tischen auf und nennt es eine künstlerische Pause.',
      'Der Impresario hat sie über Nacht ersetzt, als sie mehr Gage verlangte. Kapellmeister Bela dirigierte ihre letzte Vorstellung absichtlich einen halben Ton zu hoch. Roxy hat beiden Rosen geschickt. Mit Dornen.',
      'Was niemand weiß: Das Rialto steht auf ihrem Namen. Der Impresario hat es ihr in einer schwachen Stunde überschrieben, um es vor der Spielbank zu retten. Roxy wartet nur auf den richtigen Abend für ihre Zugabe.'
    ],
    bruiser: [
      'Knochen-Kalle tut, was der Boss sagt. Der Boss ist der Schieber. Wenn Kalle verliert, haut der Boss Kalle. Kalle findet das gerecht.',
      'Er hat Bruno den Kiefer gebrochen und danach drei Tage an dessen Bett gesessen. Seitdem bekommt er im Hahn jedes Bier umsonst und schämt sich bei jedem einzelnen.',
      'Kalle kann zählen. Er zählt sogar sehr gut. Er hat gemerkt, dass der Schieber dem Hausherrn jede Woche etwas weniger abliefert. Kalle hat es niemandem gesagt, weil ihn niemand gefragt hat.'
    ],
    pianist: [
      'Fingers spielt jeden Abend dasselbe Lied in einer anderen Tonart. Er hört am Rascheln, welche Karten du hältst – jedenfalls die ersten paar Züge, dann schweift er ab.',
      'Er saß am Flügel in Belas Tanzkapelle, bis er einmal das Solo des Kapellmeisters besser spielte als der Kapellmeister. Am nächsten Morgen stand sein Klavierhocker auf der Straße.',
      'Das Lied ist für die Sirene. Sie hat im Rauchsalon gesungen, er hat sie begleitet, und dann hat ihr jemand ein Engagement angeboten, bei dem man die Seele mitbringen muss. Fingers spielt, bis sie zurückkommt.'
    ],
    bookie: [
      'Quoten-Otto nimmt Wetten auf alles an: Pferde, Boxkämpfe, wie lange du durchhältst. Er ist dabei viermal bankrottgegangen und hält das für eine gute Quote.',
      'Seine Schulden gehören längst nicht mehr ihm. Zahlmeister Pfennig hat sie aufgekauft, mit Geld aus der Bordkasse der Fortuna, und reicht sie weiter an die Spielbank – gegen eine kleine Gebühr.',
      'Otto führt ein zweites Buch. Darin steht eine einzige Wette, hundert zu eins: dass das Haus eines Tages brennt. Der Einsatz stammt von Manfred. Otto hat ihn angenommen, weil er Manfred mag und an die Quote glaubt.'
    ],
    // ---------- Elite ----------
    'card-counter': [
      'Dr. Zahl hat nachgerechnet. Er rechnet immer nach. Er kennt dein Blatt, bevor du es sortiert hast, und findet dich statistisch uninteressant.',
      'Er war Chefmathematiker der Spielbank Monopol. Dann bewies er dem Direktor auf vier Seiten, dass die Roulettekessel des Hauses nicht ganz rund laufen. Der Direktor dankte ihm und ließ ihn vom Tresorwächter hinausbegleiten.',
      'Die vier Seiten hat er noch. Auf der fünften, die er nie abgegeben hat, steht eine andere Rechnung: wie lange ein Haus hundert Jahre lang ungeschlagen bleiben kann. Das Ergebnis ist null. Dr. Zahl glaubt nicht an Wunder. Er glaubt an Verträge.'
    ],
    'double-igniter': [
      'Funke zündet alles zweimal an, zur Sicherheit. Er riecht nach Schwefel, lacht zu laut und hat an jeder Hand weniger Fingernägel, als ihm zustehen.',
      'Gelernt hat er bei Heizer Ruß, im Kesselraum der Fortuna. Ruß brachte ihm bei, ein Feuer zu halten. Funke interessierte sich mehr dafür, wie man eines anfängt.',
      'Das alte Rialto ist abgebrannt, bevor der Impresario das neue baute. Die Versicherung zahlte gut. Funke bekam dafür eine Lebensstellung im Hahn und die Auflage, nie darüber zu reden. Er redet nicht. Er kichert nur.'
    ],
    'black-widow': [
      'Vera trägt Schwarz, seit sie neunzehn ist, und sie trägt es gern. Vier Ehemänner, vier Testamente, vier sehr schöne Beerdigungen.',
      'Der erste war der einzige Sohn der Baronin von Hohenstein. Die Baronin hat Vera nie verziehen und ihr trotzdem jedes Jahr zum Todestag Blumen geschickt. Weiße Lilien, ohne Karte.',
      'Der vierte war Donna Scarlattas Bruder. Vera schwört, dass sie ihn geliebt hat. Sie schwört auch, dass sie nichts dafür kann – die Flüche seien nur geliehen, und der Verleiher nehme sich die Zinsen, bei wem er wolle.'
    ],
    pickpocket: [
      'Sally hat die schnellsten Finger der Stadt und ein erstaunlich gutes Gewissen. Wer sie erwischt, bekommt seine Uhr zurück. Und eine zweite dazu, die ihm nicht gehört.',
      'Sie ist in Manfreds Laden aufgewachsen, zwischen Kisten und Kartenstapeln. Manfred hat ihr und ihrem kleinen Bruder Anton Lesen, Rechnen und Feilschen beigebracht. Das Stehlen kam von selbst.',
      'Ihr größter Griff war ein Collier aus der Fürstensuite des Imperial. Anton hielt die Tür auf. Das Collier trägt heute Diamanten-Dolores – und die Baronin lässt seit Jahren danach suchen, ohne zu ahnen, wie oft sie schon daran vorbeigegangen ist.'
    ],
    bouncer: [
      'Schrank steht seit fünfzehn Jahren an der Tür des Hahn. Er hat in der Zeit genau zwei Worte gelernt, und beide heißen „Nein“.',
      'Sein Bruder Brock bewacht den Tresor der Spielbank. Die beiden sehen sich einmal im Jahr, an Weihnachten, und reden dann über Türen. Es sind die schönsten Stunden ihres Jahres.',
      'Schrank weiß, wer durch die Hintertür kommt. Einmal im Jahr lässt er einen Herrn im roten Frack herein, der nie anklopft, und einmal in der Woche Manfred, der immer etwas im Hahn vergisst. Schrank fragt nicht. Dafür wird er bezahlt.'
    ],
    // ---------- Bosse des Hahn ----------
    'boss-shark': [
      'Der Schieber führt das Hinterzimmer für den Hausherrn. Er fängt immer mit zwei Karten Vorsprung an und nennt das Hausrabatt.',
      'Er und Rico haben auf Jahrmärkten angefangen, mit drei Hütchen und einer Erbse. Die Erbse hat er noch. Auch das Auge der Kapitänin Fortuna geht auf seine Rechnung – ein Streit um ein Blatt, eine Flasche, ein Missverständnis, sagt er.',
      'Der Schieber liefert dem Hausherrn jede Woche etwas weniger ab. Er spart auf ein eigenes Haus. Der Direktor der Spielbank hat ihm den Kredit dafür schon zugesagt, und der Schieber hat nicht gelesen, was er unterschrieben hat.'
    ],
    'boss-dolores': [
      'Diamanten-Dolores trägt mehr Karat am Hals als die Spielbank im Tresor. Sie hält ihre Joker wie ihre Steine: nah am Körper und nie alle auf einmal.',
      'Sie war die große Liebe des Hausherrn, als der noch Liebe kannte. Er schenkte ihr zu jedem Jahrestag einen Stein. Nach dem zwanzigsten fiel ihr auf, dass er nicht älter wurde.',
      'Ihr schönstes Collier stammt nicht von ihm, sondern aus Sallys Tasche, und gehörte davor der Baronin von Hohenstein. Dolores weiß das. Sie trägt es trotzdem zu jedem Empfang im Imperial, in die erste Reihe.'
    ],
    'boss-smoke': [
      'Madame Rauch gehört der Rauchsalon und alles, was darin gesagt wird. Was du gegen sie ausspielst, kommt zurück – das gilt für Karten wie für Gerüchte.',
      'Sie und Donna Scarlatta haben die halbe Stadt zusammen aufgebaut und sich über die andere Hälfte zerstritten. Seitdem grüßen sie einander mit Küsschen und lassen einander beschatten.',
      'Die Sirene war ihre Schülerin, das begabteste Mädchen, das je in ihrem Salon gesungen hat. Madame Rauch hat ihr den Vertrag mit dem Inferno selbst vermittelt. Es war das einzige Geschäft, das sie je bereut hat, und sie raucht seither doppelt so viel.'
    ],
    'boss-consigliere': [
      'Der Consigliere spricht leise, weil ihm alle zuhören. Er regelt für Donna Scarlatta alles, was sich auf Papier regeln lässt, und das Kleingedruckte schreibt er selbst.',
      'Jeder Vertrag in dieser Stadt ist durch seine Hände gegangen: die Hypothek des Grandhotels, die Schuldscheine der Spielbank, die Überschreibung des Rialto. Er hat von jedem eine Abschrift, und in jeder Abschrift einen Paragrafen sieben.',
      'Einen Vertrag hat er nicht aufgesetzt, nur gelesen: den des Hausherrn. Hundert Jahre ungeschlagen, gegen eine Sicherheit, die nicht in Mark beziffert ist. Die Frist läuft ab. Der Consigliere hat Donna geraten, sich bereitzuhalten.'
    ],
    'boss-house': [
      'Der Hausherr sitzt seit hundert Jahren am selben Tisch und hat nie verloren. Die Stadt hält das für eine Redensart. Sein Schneider weiß es besser: Die Maße haben sich nie geändert.',
      'Er war ein kleiner Wirt mit Schulden, als ein Herr im roten Frack ihm ein Geschäft vorschlug: hundert Jahre Glück für das Haus, Zahlung am Ende. Er hat unterschrieben und Dolores, die er liebte, nichts davon gesagt.',
      'Die hundert Jahre sind um. Deshalb kann das Haus brennen, und deshalb sitzt du an seinem Tisch. Der Hausherr hofft insgeheim, dass du gewinnst – ein Haus, das einem nicht mehr gehört, kann man ihm auch nicht mehr nehmen.'
    ],
    'boss-donna': [
      'Donna Scarlatta gehört die Stadt, bis auf den Goldenen Hahn. Das ärgert sie jeden Morgen beim Kaffee. Sie legt Paare, weil sie nichts einzeln tut.',
      'Ihr Bruder wollte das Geschäft übernehmen und heiratete stattdessen Vera. Ein halbes Jahr später schickte Donna Blumen. Sie hat Vera nie etwas nachweisen können und sie deshalb in ihrer Nähe behalten.',
      'Mit Madame Rauch hat sie einst alles geteilt. Mit dem Consigliere teilt sie heute das Wissen um den Vertrag des Hausherrn. Donna wartet nicht darauf, dass das Haus brennt. Sie wartet darauf, die Asche zu kaufen.'
    ],
    // ---------- Tanzpalast Rialto ----------
    'taxi-dancer': [
      'Mimi tanzt für zehn Pfennig das Lied und hat Blasen an Füßen, von denen die Herren nichts ahnen. Sie führt immer, auch wenn sie so tut, als folge sie.',
      'Mit Lola teilte sie eine Mansarde und ein einziges Paar guter Schuhe. Die Schachteln ohne Absender, die jede Woche kommen, erkennt sie an der Schleife. Sie raucht keine davon. Sie hebt sie auf.',
      'Mimi hat Roxys alte Garderobe geerbt und in einer Hutschachtel ein Papier gefunden, auf dem das Rialto einem anderen Namen gehört als dem des Impresario. Sie hat es zurückgelegt und tanzt seitdem ein wenig vorsichtiger.'
    ],
    bandleader: [
      'Kapellmeister Bela dirigiert mit geschlossenen Augen, damit er das Orchester nicht ansehen muss. Er gibt immer den Auftakt, auch am Kartentisch.',
      'Fingers hat einmal sein Solo besser gespielt als er. Bela ließ noch in derselben Nacht den Klavierhocker auf die Straße stellen. Er hört das Solo seitdem jede Nacht, im Schlaf, fehlerfrei.',
      'Roxys Abschiedsvorstellung hat er absichtlich zu hoch dirigiert, auf Wunsch des Impresario. Zum Dank bekam er einen Vertrag auf Lebenszeit. Bela hat erst später gelesen, wer das Rialto wirklich besitzt, und übt seitdem Entschuldigungen.'
    ],
    'boss-impresario': [
      'Der Impresario hat das Rialto aus der Asche gestampft, sagt er gern. Dass es vorher erst zu Asche werden musste, erwähnt er nicht. Jeder Stern im Haus gehört ihm, bis er einen neuen findet.',
      'Die Fortuna war einmal sein Schiff. Er hat sie in einer einzigen Nacht an eine einäugige Frau verloren, mit einem Blatt, das er für unschlagbar hielt. Er spricht von einem Geschenk.',
      'Das neue Rialto ist mit Geld der Spielbank gebaut. Als der Direktor die Raten erhöhte, überschrieb der Impresario das Haus heimlich auf Roxy, um es zu retten – und entließ sie eine Woche später. Es war der teuerste Fehler seines Lebens, und er weiß es noch nicht.'
    ],
    // ---------- Dampfer Fortuna ----------
    sailor: [
      'Matrose Hein fährt zur See, seit er laufen kann. An Land wird ihm schlecht. Er spielt, wie er rudert: gleichmäßig, stur und gegen die Strömung.',
      'Auf einem Frachter vor Kap Hoorn hat er den Schiffskoch aus dem Wasser gezogen. Der Koch hieß Bruno und schickt ihm seither jedes Jahr eine Flasche. Hein trinkt sie auf Brunos Wohl und schickt sie leer zurück, damit er weiß, dass sie angekommen ist.',
      'Hein hat gesehen, wie Zahlmeister Pfennig nachts Säcke aus der Bordkasse an Land rudert. Er hat es der Kapitänin nicht gesagt. Die Kapitänin weiß es ohnehin. Auf See, sagt sie, wirft man keinen über Bord, den man noch als Köder braucht.'
    ],
    purser: [
      'Zahlmeister Pfennig zählt jede Mark an Bord zweimal: einmal für die Bücher und einmal für sich. Die Differenz nennt er Schwund.',
      'Mit dem Schwund kauft er Schuldscheine, die keiner mehr haben will – Quoten-Ottos zum Beispiel, oder Ricos. Er reicht sie an die Spielbank weiter und hält sich für einen Geschäftsmann.',
      'Pfennig ist der Mann des Direktors an Bord. Sein Auftrag: die Fortuna in die roten Zahlen rechnen, bis die Kapitänin verkaufen muss. Er ist fast so weit. Was er nicht weiß: Die Kapitänin führt ein drittes Buch, und darin steht sein Name ganz oben.'
    ],
    'boss-captain': [
      'Kapitänin Fortuna hat ihr Schiff nach sich benannt oder sich nach ihrem Schiff, das weiß niemand mehr. Draußen vor der Küste gilt kein Gesetz außer ihrem.',
      'Das Auge hat sie beim Schieber gelassen, in einem Jahrmarktszelt, wegen eines Blatts, das er nicht hätte haben dürfen. Das Schiff hat sie dem Impresario abgenommen, mit einem Blatt, das sie nicht hätte haben dürfen. Sie hält das für ausgeglichen.',
      'Heizer Ruß hat zwanzig Jahre ihre Kessel befeuert, bis ihm ein Herr im roten Frack bessere Kohle versprach. Die Kapitänin hat ihn ziehen lassen und sich geschworen: Wenn das Inferno eines Tages einen neuen Wirt braucht, legt die Fortuna dort an.'
    ],
    // ---------- Grandhotel Imperial ----------
    bellboy: [
      'Page Anton trägt Koffer, Nachrichten und gelegentlich Dinge, die nicht in Koffer gehören. Er ist vierzehn, sagt sechzehn und verdient mehr Trinkgeld als der Concierge Gehalt.',
      'Er ist bei Manfred im Laden aufgewachsen, mit seiner großen Schwester Sally. Sie hat ihm beigebracht, dass man Türen aufhält – und für wen. In der Nacht mit dem Collier stand er Schmiere und hat dabei gepfiffen.',
      'Anton kennt jeden Dienstbotengang im Imperial, auch den zugemauerten hinter der Fürstensuite. Dort liegen die Briefe, die der Sohn der Baronin an Vera schrieb. Anton hat sie gelesen. Sie sind erstaunlich glücklich.'
    ],
    concierge: [
      'Concierge Laurent erfüllt jeden Wunsch, bevor er geäußert wird. Er hat zu jeder Tür des Hauses einen Schlüssel und zu den meisten Gästen ein Geheimnis.',
      'Er dient der Baronin seit vierzig Jahren. Er hat ihr den Sohn beerdigt, die Gläubiger vom Leib gehalten und jeden Morgen die Zeitung gebügelt. Dass er sie liebt, hat er ihr in vierzig Jahren nicht ein einziges Mal gesagt.',
      'Die Hypothek auf das Imperial liegt bei der Spielbank. Laurent zahlt die Raten seit drei Jahren aus eigener Tasche, damit die Baronin es nicht merkt – mit dem, was Sally ihm für einen bestimmten Schlüssel gegeben hat. Er hält das für Verrat. Er würde es wieder tun.'
    ],
    'boss-baroness': [
      'Die Baronin von Hohenstein bewohnt die oberste Etage ihres eigenen Hotels und kommt nur zum Kartenspiel herunter. Ihr Urgroßvater hat das Haus am Spieltisch gewonnen. Sie gedenkt nicht, es dort zu verlieren.',
      'Ihr einziger Sohn heiratete eine Neunzehnjährige in Schwarz und war ein Jahr später tot. Die Baronin schickt Vera jedes Jahr weiße Lilien. Sie hat nie entschieden, ob es eine Drohung ist oder eine Bitte.',
      'Sie weiß längst, dass ihr Collier am Hals von Dolores hängt und dass Laurent ihre Raten zahlt. Sie sagt zu beidem nichts. Eine Hohenstein, sagt sie, erkennt man daran, was sie übersieht – und daran, wann sie damit aufhört.'
    ],
    // ---------- Spielbank Monopol ----------
    croupier: [
      'Croupier Klara sagt nur drei Sätze am Abend, alle auf Französisch. Ihre Hände sind so ruhig, dass die Kugel sich vor ihr geniert.',
      'Gelernt hat sie bei Emil im Goldenen Hahn. Sein Kartenspiel liegt bis heute ungeöffnet in ihrem Spind. Sie ist gegangen, weil die Spielbank das Dreifache zahlte, und geblieben, weil die Spielbank niemanden gehen lässt.',
      'Klara hat gemerkt, dass die Kessel nicht rund laufen, lange vor Dr. Zahl. Sie hat geschwiegen und zugesehen, wie man ihn hinausbegleitete. Seitdem lässt sie die Kugel ab und zu fallen, wie sie fallen will. Der Direktor nennt das Schwund.'
    ],
    'vault-guard': [
      'Tresorwächter Brock ist breiter als die Tür, die er bewacht. Er war noch nie im Tresor. Es interessiert ihn nicht, was drin ist, nur, dass es drin bleibt.',
      'Sein Bruder Schrank steht an der Tür des Goldenen Hahn. Weihnachten reden sie über Schlösser, Scharniere und die gute alte Zeit, als Türen noch aus Eiche waren.',
      'Brock hat Dr. Zahl hinausbegleitet und ihm an der Treppe den Hut wieder aufgesetzt. Seitdem weiß er, dass im Tresor kaum Geld liegt, nur Papier: Schuldscheine der halben Stadt. Und ganz hinten ein leeres Fach, beschriftet mit „Zum Goldenen Hahn“.'
    ],
    'boss-director': [
      'Direktor Monopol spielt nicht. Er lässt spielen und rechnet ab. Er kennt deine Hand, weil er deine Akte kennt, und deine Akte kennt er, weil er sie hat anlegen lassen.',
      'Ihm gehören die Schulden des Rialto, die Hypothek des Imperial und bald die Bücher der Fortuna. Dr. Zahl hat er entlassen, weil der die Wahrheit ausgerechnet hatte. Pfennig bezahlt er, weil der sie nie ausrechnen wird.',
      'Nur ein Haus kann er nicht kaufen, weil es seit hundert Jahren nie Schulden hatte. Der Direktor hat nachforschen lassen, warum, und danach zum ersten Mal in seinem Leben ein Geschäft abgelehnt. Mit dem Herrn im roten Frack, sagt er, macht nur einer Gewinn.'
    ],
    // ---------- Das Inferno ----------
    stoker: [
      'Heizer Ruß schaufelt Kohle in einen Ofen, der nie satt wird. Er hat seit Jahren keinen Himmel gesehen und vermisst vor allem den Regen.',
      'Zwanzig Jahre befeuerte er die Kessel der Fortuna und brachte einem zappeligen Jungen namens Funke bei, was Glut ist. Dann bot ihm ein Herr im roten Frack einen Ofen an, der nie ausgeht. Ruß hat nicht gefragt, womit er geheizt wird.',
      'Inzwischen weiß er es: mit Verträgen. Jeder, der abläuft, gibt eine Schaufel. Auf der nächsten steht der Name des Hausherrn. Ruß hat die Schaufel beiseitegestellt und wartet ab, wie dein Abend ausgeht.'
    ],
    siren: [
      'Die Sirene singt im Inferno jede Nacht vor ausverkauftem Haus. Wer ihr zuhört, vergisst, was er auf der Hand hält. Sie selbst hat vergessen, wie ihr eigener Name klang.',
      'Sie war Madame Rauchs begabteste Schülerin und sang im Rauchsalon, begleitet von einem Pianisten, der nie ein Wort herausbrachte. Sie hat auf das Wort gewartet. Dann kam der Vertrag, und der Vertrag redete sehr schön.',
      'In ihrem Vertrag steht, dass sie frei ist, sobald jemand ihr Lied zu Ende spielt. Es fehlen acht Takte. Fingers spielt sie jede Nacht im Goldenen Hahn, in jeder Tonart außer der richtigen – er kennt den Schluss nicht, weil sie ihn nie gesungen hat.'
    ],
    'boss-prince': [
      'Der Fürst ist ein vollendeter Gastgeber. Er vergisst kein Gesicht, keinen Namen und keine Frist. Sein Haus liegt ganz unten, und trotzdem kommt jeder irgendwann vorbei.',
      'Er verleiht, was man sich wünscht: Glück für ein Haus, Flüche für eine Witwe, eine Stimme, einen Ofen, der nie ausgeht. Er nimmt dafür keine Mark. Er ist der Herr im roten Frack, und er kommt immer selbst, um abzuholen.',
      'Der Vertrag des Hausherrn läuft ab, und der Fürst hat bemerkt, dass jemand mit einer Schachtel Streichhölzer durch seine Stadt zieht. Er hat nachgesehen: Mit dir hat er nichts unterschrieben. Das ist ihm seit sehr langer Zeit nicht mehr passiert, und es gefällt ihm ganz und gar nicht.'
    ]
  };

  /* Hinter dem Tresen: Manfred und Esme. Ihre Akten öffnen sich nicht durch Siege, sondern durch Kundschaft
     (feat: Zählwerk aus js/meta.js, steps: ab wie vielen Käufen bzw. Veredelungen). */
  ZU.LORE_SHOP = {
    manfred: {
      name: 'Manfred', role: 'Händler', art: 'manfred/manfred.png', feat: 'bought', unit: 'Käufe', steps: [1, 15, 40],
      pages: [
        'Manfred verkauft alles, was sich tragen lässt, und einiges, was man besser liegen ließe. Sein Laden hat keine Adresse: Er steht einfach immer dort, wo gerade ein Tisch frei wird.',
        'Er hat Sally und Anton großgezogen, zwischen Kisten und Kartenstapeln, und behauptet bis heute, das sei eine reine Geschäftsbeziehung gewesen. Auf seinem Tresen steht ein Rechenschieber, den Anton ihm geschnitzt hat. Er benutzt ihn nie und staubt ihn jeden Morgen ab.',
        'Manfred hat bei Quoten-Otto hundert zu eins gewettet, dass das Haus brennt – und dir die Streichhölzer verkauft. Er hat einmal mit dem Fürsten gefeilscht und als Einziger nichts unterschrieben. Das Nebenzimmer hat er an Esme vermietet, viel zu billig, und hofft, dass sie es nie nachrechnet.'
      ]
    },
    esme: {
      name: 'Esme', role: 'Wahrsagerin', art: 'esme/esme.png', feat: 'sealed', unit: 'Veredelungen', steps: [1, 5, 15],
      pages: [
        'Esme hat das Nebenzimmer von Manfred gemietet, auf unbestimmte Zeit und zu einer Miete, über die beide seit Jahren mit Genuss streiten. Sie liest Karten, Hände und Kontoauszüge, am liebsten in dieser Reihenfolge.',
        'Sie hat Madame Rauch die Zukunft gelegt, Vera vier Hochzeiten und der Baronin den Verlust ihres Colliers – jeweils gegen Vorkasse. Dem Hausherrn hat sie nur eine einzige Karte umgedreht und ihm das Geld zurückgegeben. Das ist ihr vorher und nachher nie wieder passiert.',
        'Ihre eigenen Karten zeigen ihr seit Jahren denselben Mann: rote Weste, flinke Finger, erbärmlich im Kopfrechnen, sobald sie ihn ansieht. Esme hat die Karte aus dem Deck genommen. Sie liegt unter ihrer Kasse, mit dem Gesicht nach oben. Die Miete hat sie längst nachgerechnet.'
      ]
    }
  };
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
