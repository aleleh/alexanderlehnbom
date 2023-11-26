import React from 'react';
import Header from './components/Header';
import About from './components/About';
import Projects from './components/Projects';
import Contact from './components/Contact';
import Images from './components/Images';
import Favorites from './components/Favorites';

function App() {
  return (
    <div className="App">
      <Header />
      <About />
      <Images />
      <Projects />
      <Favorites />
      <Contact />
    </div>
  );
}

export default App;
