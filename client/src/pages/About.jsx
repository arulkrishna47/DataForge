const About = () => {
  return (
    <div className="bg-navy text-white min-h-screen pt-40 pb-20">
      <div className="container mx-auto px-6">
        <h1 className="text-5xl font-extrabold mb-10 tracking-tighter uppercase italic">About <span className="text-primary">Cortexa</span></h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="text-slate-400 leading-relaxed text-lg space-y-6">
            <p>Cortexa was founded on a simple principle: Machine Learning is only as good as the data it's built with.</p>
            <p>We are a distributed team of data scientists and engineers dedicated to solving the bottleneck in AI development. By combining high-speed web scraping with human-in-the-loop annotation and rigorous model benchmarking, we provide the raw material that powers tomorrow's innovations.</p>
          </div>
          <div className="bg-slate-900 p-10 border border-slate-800 rounded-3xl">
            <h3 className="text-xl font-bold mb-6 text-primary uppercase tracking-widest">Our Mission</h3>
            <p className="text-slate-300">To accelerate the safe and efficient deployment of AI by providing the highest quality data infrastructure on the planet.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
