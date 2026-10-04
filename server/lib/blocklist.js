const CORE = ("anal anilingus anus arse arsehole arseholes arses ass asses asshole assholes autoerotic bastard bastinado " +
  "bestiality bimbos bitch bitches bitchy blowjob blowjobs bollocks boner boners boob boobs buggery bullshit " +
  "bunghole busty clit clitoris clits cock cocks condom condoms coon coons coprophilia crap crappy " +
  "craps cum cums cunnilingus cunt cunts darkie dick dickhead dickheads dicks dildo dildos dingleberries " +
  "dingleberry dominatrix ejaculation erotic erotism fag faggot faggots fags fannies fanny fecal fellatio figging " +
  "fisting fuck fucked fucker fuckers fucking fucks gangbang genitals handjob handjobs homoerotic honkey horny " +
  "humping incest intercourse jailbait jigaboo jizz kike kinky lovemaking masturbate masturbating masturbation milf milfs " +
  "minge minges motherfucker nigger niggers nipple nipples nude nudity nympho nymphomania orgasm orgasms orgies " +
  "orgy panties panty pedophile penis penises piss pissed pisses pissing playboy poof poofs poofter " +
  "poofters poon porn porno pornography pube pubes pussy rape raped rapes raping rapist rapists " +
  "rectum retard retarded retards rimming sadism scat scrotum semen sex sexed sexes sexier sexiest " +
  "sexual sexuality sexually sexy shagged shagging shit shite shits shitty skank skanks skanky slut " +
  "sluts smut sodomize sodomy spastic spic spunk strappado swastika swinger threesome throating tit tits " +
  "titties titty topless tosser tossers turd turds tushy twat twats undressing vagina vaginas vibrator " +
  "voyeur vulva wank wanker wankers wanks wetback whore whores").split(" ");

// Slurs, with every form of each that the ENABLE dictionary lists.
const SLURS = ("abo abos chink chinked chinkier chinkiest chinking chinks chinky coolie coolies dago dagoes dagos " +
  "darkey darkeys darkies darky dyke dyked dykes dykey dyking golliwog golliwogs gollywog gollywogs gook gooks gooky " +
  "gyp gypped gypper gyppers gypping gyps hebe hebes homo homos honkeys honkie honkies honky jew jewed jewing jews " +
  "jigaboos kikes lezzie lezzies lezzy mick micks mongoloid mongoloids mulatto mulattoes mulattos octoroon octoroons " +
  "peckerwood peckerwoods pickaninnies pickaninny quadroon quadroons redskin redskins sambo sambos sheenies sheeny " +
  "shylock shylocked shylocking shylocks spastics spaz spazzes spick spicks spics spik spiks squaw squaws " +
  "welsh welshed welsher welshers welshes welshing wetbacks whitey whiteys wog wogs wop wops yid yids").split(" ");

// Forms of CORE words that slipped past exact matching. Innocent look-alikes are deliberately
// left out: assess, cocky, cocker, dicker, retarding, scatter, spicy, spiky, spunky, titter, vibratory.
const FORMS = ("anally anilinguses anuses bastards bastardy bastinadoed bastinadoes bastinadoing bestialities bitched bitching " +
  "buggeries bullshits bullshitted bullshitting bungholes clitorises coprophilias crapped crapper crappers crapping " +
  "cunnilinguses dicked dicking dildoes dominatrixes ejaculations erotics erotisms fagged fagging faggoted faggoting faggoty " +
  "faggy fellatios gangbanger gangbangers gangbangs incests intercourses lovemakings masturbated masturbates masturbations " +
  "motherfuckers nippled nuder nudes nudities nymphomanias nymphos pedophiles pisser pissers playboys poons pornographies " +
  "pornos porns porny pussies raper rapers rectums sadisms scats scrotums semens sexing sexualities shitted shitting slutty " +
  "smuts smutted smutting smutty sodomies sodomized sodomizes sodomizing spunked spunking spunks strappadoes strappados " +
  "swastikas swingers threesomes tushies vibrators voyeurs vulvas whored whoring").split(" ");

export const BLOCKLIST = new Set([...CORE, ...SLURS, ...FORMS]);

export const SEVERE_LONG = new Set(["arsehole","asshole","bastard","bitches","buggery","faggots","fuckers","fucking","niggers","poofter","spastic","wetback",
  "golliwog","gollywog","mongoloid","mulatto","octoroon","peckerwood","pickaninny","quadroon","redskin","redskins","shylock","wetbacks"]);
