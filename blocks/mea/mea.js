export default function decorate(block) {
  const title = block.dataset.title || 'My MEA Block';
  const description = block.dataset.description || 'This is a simple MEA block rendered with vanilla JS.';
  const buttonText = block.dataset.cta || 'Click Me';
  const buttonLink = block.dataset.link || '#';

  block.innerHTML = `
    <div class="mea-container">
      <h2>${title}</h2>
      <p>${description}</p>
      <a class="mea-button" href="${buttonLink}">${buttonText}</a>
    </div>
    `;
}
